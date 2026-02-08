import {
    REQUIRED_MESSAGE,
    getFields,
    getStageCount,
    getVisibleFields,
    isMultiStage,
    isPlainTextField,
    shouldDisplayField
} from "./schemaUtils.js";

// Configuration constants
const RENDER_DEBOUNCE_MS = 200; // Delay for debounced re-renders during text input
const INPUT_EVENT_TYPES = new Set(["text", "textarea", "email", "tel", "number", "date", "search", "url", "password"]);

let nextInstanceId = 0;

// Pure utility functions (no instance state needed)

function isElementVisible(element) {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    if (element.hidden || element.getAttribute("aria-hidden") === "true") {
        return false;
    }

    return element.offsetParent !== null || element.getClientRects().length > 0;
}

function applyInputAttributes(element, field) {
    if (!element || !field) {
        return;
    }

    if (field.placeholder && element.tagName !== "SELECT") {
        element.placeholder = field.placeholder;
    }

    if (field.attributes && typeof field.attributes === "object") {
        Object.entries(field.attributes).forEach(([attr, value]) => {
            if (value === undefined || value === null || value === false) {
                return;
            }

            if (value === true) {
                element.setAttribute(attr, "");
                return;
            }

            element.setAttribute(attr, value);
        });
    }
}

function resolveOptionLabel(field, value) {
    if (!Array.isArray(field.options)) {
        return value;
    }

    const match = field.options.find(option => {
        const optionValue = typeof option === "string" ? option : option.value;
        return optionValue === value;
    });

    if (!match) {
        return value;
    }

    return typeof match === "string" ? match : (match.label ?? match.value);
}

function formatFieldValue(field, value) {
    const emptyValue = "—";

    if (field.type === "checkbox") {
        if (value === undefined || value === null || value === "") {
            return emptyValue;
        }
        return value ? "כן" : "לא";
    }

    if (value === undefined || value === null || value === "") {
        return emptyValue;
    }

    if (field.type === "select" || field.type === "radio") {
        const label = resolveOptionLabel(field, value);
        return label ?? emptyValue;
    }

    return String(value);
}

function getControllerFields(schema) {
    const fields = getFields(schema);
    return new Set(
        fields
            .map(field => field?.showIf?.field)
            .filter(Boolean)
    );
}

function resolveFocusableIndex(focusables, activeElement, fallbackTarget) {
    if (activeElement instanceof HTMLElement) {
        const activeIndex = focusables.indexOf(activeElement);
        if (activeIndex !== -1) {
            return { index: activeIndex, source: "active" };
        }
    }

    if (fallbackTarget) {
        if (fallbackTarget.id) {
            const idIndex = focusables.findIndex(element => element.id === fallbackTarget.id);
            if (idIndex !== -1) {
                return { index: idIndex, source: "fallback" };
            }
        }

        if (fallbackTarget.name) {
            const nameMatchIndex = focusables.findIndex(element => {
                if (element.getAttribute("name") !== fallbackTarget.name) {
                    return false;
                }

                if (element instanceof HTMLInputElement && element.type === "radio") {
                    return element.checked;
                }

                return true;
            });

            if (nameMatchIndex !== -1) {
                return { index: nameMatchIndex, source: "fallback" };
            }

            const anyNameIndex = focusables.findIndex(element => element.getAttribute("name") === fallbackTarget.name);
            if (anyNameIndex !== -1) {
                return { index: anyNameIndex, source: "fallback" };
            }
        }
    }

    return { index: -1, source: "none" };
}

// FormBuilderBase class — shared rendering, state, and interaction logic.
// Subclasses must override template methods for persistence, validation, and submission.

export class FormBuilderBase {
    constructor(root) {
        if (!(root instanceof HTMLElement)) {
            throw new Error("FormBuilderBase requires a root HTMLElement");
        }

        this.root = root;
        this.instanceId = root.dataset.formBuilder || root.id || `fb-${nextInstanceId++}`;

        // Find form element and create UI chrome dynamically
        this.container = root.querySelector("form");
        this.stageIndicator = this._createStageIndicator();
        const { controls, prevButton, nextButton, submitButton, resetButton } = this._createControls();
        this.controls = controls;
        this.prevButton = prevButton;
        this.nextButton = nextButton;
        this.submitButton = submitButton;
        this.resetButton = resetButton;

        // Instance state
        this.currentStage = 0;
        this.formAbortController = null;
        this.stageIndicatorAbortController = null;
        this.furthestStageReached = 0;

        /**
         * Focus version increments on every focusin event to track focus changes.
         * This prevents restoring focus to stale targets after multiple rapid re-renders.
         * When a render captures a focus target, it saves the current focusVersion.
         * If the version has changed by the time restoration happens, the target is considered stale.
         */
        this.focusVersion = 0;
        this.lastStageFocusTarget = null;

        this.pendingRenderTimers = new Map();
        this.activeSchema = null;
        this.state = {};
        this.isSubmitting = false;
        this.submitFeedback = null;
        this.isLoadingSchema = false;

        // Create instance-scoped live region for screen reader announcements
        this.liveRegion = document.createElement("div");
        this.liveRegion.id = this._scopedId("live-region");
        this.liveRegion.setAttribute("aria-live", "polite");
        this.liveRegion.setAttribute("aria-atomic", "true");
        this.liveRegion.className = "visually-hidden";
        this.root.appendChild(this.liveRegion);

        this._bindEvents();
        this._init();
    }

    // --- Template methods (override in subclasses) ---

    /** Override to initialize the form (e.g., load schema from DOM). */
    async _init() {}

    /** Override to persist form state (e.g., to localStorage). */
    _saveDraft() {}

    /** Override to load persisted state. Must return an object. */
    _loadDraft() {
        return {};
    }

    /** Override to clear persisted state. */
    _clearDraft() {}

    /** Override to submit form data (e.g., HTTP POST or alert). */
    async _postPayload(payload) {
        return false;
    }

    /** Override to validate the current stage. Must return an errors object (empty = valid). */
    _validateStage(stageIndex = null) {
        return {};
    }

    // --- Scoped ID helpers ---

    _scopedId(name) {
        return `${this.instanceId}--${name}`;
    }

    _fieldId(fieldName) {
        return this._scopedId(fieldName);
    }

    _helperId(fieldName) {
        return this._scopedId(`${fieldName}-helper`);
    }

    _errorId(fieldName) {
        return this._scopedId(`${fieldName}-error`);
    }

    _radioOptionId(fieldName, optionValue) {
        return this._scopedId(`${fieldName}-${String(optionValue).replace(/\s+/g, "-")}`);
    }

    _radioGroupLabelId(fieldName) {
        return this._scopedId(`${fieldName}-label`);
    }

    // --- Schema error display ---

    _displaySchemaError(message) {
        if (!this.container) {
            return;
        }

        this.container.innerHTML = "";
        const errorDiv = document.createElement("div");
        errorDiv.className = "alert alert-danger";
        errorDiv.setAttribute("role", "alert");
        errorDiv.innerHTML = `
            <h4 class="alert-heading">שגיאה בטעינת הטופס</h4>
            <p>${message}</p>
        `;
        this.container.appendChild(errorDiv);

        if (this.controls) {
            this.controls.style.display = "none";
        }
    }

    // --- Submit feedback ---

    _ensureSubmitFeedback() {
        if (this.submitFeedback) {
            return this.submitFeedback;
        }

        if (!this.container) {
            return null;
        }

        this.submitFeedback = document.createElement("div");
        this.submitFeedback.id = this._scopedId("submit-feedback");
        this.submitFeedback.className = "alert d-none mt-3";
        this.submitFeedback.setAttribute("role", "status");
        this.submitFeedback.setAttribute("aria-live", "polite");

        if (this.controls?.parentElement) {
            this.controls.parentElement.insertBefore(this.submitFeedback, this.controls);
        } else {
            this.container.after(this.submitFeedback);
        }

        return this.submitFeedback;
    }

    _setSubmitFeedback(type, message) {
        const feedback = this._ensureSubmitFeedback();
        if (!feedback) {
            return;
        }

        feedback.className = `alert alert-${type} mt-3`;
        feedback.textContent = message;
        feedback.classList.remove("d-none");
    }

    _clearSubmitFeedback() {
        if (!this.submitFeedback) {
            return;
        }

        this.submitFeedback.textContent = "";
        this.submitFeedback.className = "alert d-none mt-3";
    }

    _setSubmittingState(nextIsSubmitting) {
        this.isSubmitting = nextIsSubmitting;
        [this.prevButton, this.nextButton, this.submitButton, this.resetButton].forEach(button => {
            if (button) {
                button.disabled = nextIsSubmitting;
            }
        });

        if (this.submitButton) {
            this.submitButton.setAttribute("aria-busy", nextIsSubmitting ? "true" : "false");
        }
    }

    // --- Helper text ---

    _appendHelperText(wrapper, text, fieldName) {
        if (!text) {
            return null;
        }

        const helperId = this._helperId(fieldName);
        const helper = document.createElement("div");
        helper.className = "form-text";
        helper.id = helperId;
        helper.textContent = text;
        wrapper.appendChild(helper);
        return helperId;
    }

    // --- Field state helpers ---

    _pruneHiddenFields() {
        if (!this.activeSchema || !this.state) {
            return;
        }

        const allFields = getFields(this.activeSchema);
        allFields.forEach(field => {
            if (field?.showIf && Object.prototype.hasOwnProperty.call(this.state, field.name)) {
                if (!shouldDisplayField(field, this.state)) {
                    delete this.state[field.name];
                }
            }
        });
    }

    _buildSubmissionPayload() {
        const payload = {};
        const visibleFields = getVisibleFields(this.activeSchema, this.state);
        visibleFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(this.state, field.name)) {
                payload[field.name] = this.state[field.name];
            }
        });
        return payload;
    }

    // --- Stage helpers ---

    _getSummaryStageIndex() {
        if (!isMultiStage(this.activeSchema)) {
            return -1;
        }

        return this.activeSchema.stages.findIndex(stage => stage?.type === "summary");
    }

    _isSummaryStage(stageIndex) {
        const summaryIndex = this._getSummaryStageIndex();
        return summaryIndex !== -1 && summaryIndex === stageIndex;
    }

    _isOptionalSummaryStage() {
        const summaryIndex = this._getSummaryStageIndex();
        if (summaryIndex === -1) {
            return false;
        }

        return Boolean(this.activeSchema.stages[summaryIndex]?.optional);
    }

    _getLastDataStageIndex() {
        if (!isMultiStage(this.activeSchema)) {
            return 0;
        }

        const summaryIndex = this._getSummaryStageIndex();
        if (summaryIndex === -1) {
            return getStageCount(this.activeSchema) - 1;
        }

        return Math.max(summaryIndex - 1, 0);
    }

    // --- Rendering ---

    _renderSummaryStage() {
        if (!this.container) {
            return;
        }

        this.container.innerHTML = "";

        const summaryWrapper = document.createElement("div");
        summaryWrapper.className = "d-flex flex-column gap-3";

        const intro = document.createElement("p");
        intro.className = "text-muted mb-2";
        intro.textContent = "בדוק את הנתונים לפני שליחה.";
        summaryWrapper.appendChild(intro);

        const summaryIndex = this._getSummaryStageIndex();
        this.activeSchema.stages.forEach((stage, index) => {
            if (index === summaryIndex || stage?.type === "summary") {
                return;
            }

            const visibleFields = getVisibleFields(this.activeSchema, this.state, index);
            if (!visibleFields.length) {
                return;
            }

            const section = document.createElement("div");
            section.className = "border rounded-3 p-3 bg-white";

            const title = document.createElement("h4");
            title.className = "h6 mb-3";
            title.textContent = stage.label ?? `שלב ${index + 1}`;

            const list = document.createElement("dl");
            list.className = "row mb-0";

            visibleFields.forEach(field => {
                const term = document.createElement("dt");
                term.className = "col-5 col-sm-4 text-muted";
                term.textContent = field.label ?? field.name;

                const detail = document.createElement("dd");
                detail.className = "col-7 col-sm-8 mb-2";
                detail.textContent = formatFieldValue(field, this.state[field.name]);

                list.append(term, detail);
            });

            section.append(title, list);
            summaryWrapper.appendChild(section);
        });

        this.container.appendChild(summaryWrapper);
    }

    _renderForm(stageIndex = null) {
        // Abort previous event listeners before re-rendering
        if (this.formAbortController) {
            this.formAbortController.abort();
            this.formAbortController = null;
        }
        this.formAbortController = new AbortController();
        const { signal } = this.formAbortController;

        this.container.innerHTML = "";

        const fields = getFields(this.activeSchema, stageIndex);
        const controllerFieldSet = getControllerFields(this.activeSchema);

        fields.forEach(field => {
            if (!shouldDisplayField(field, this.state)) {
                return;
            }

            if (isPlainTextField(field)) {
                const infoBlock = document.createElement("div");
                infoBlock.className = "mb-3";
                infoBlock.dataset.plainText = "true";

                const titleText = field.title ?? field.label;
                if (titleText) {
                    const title = document.createElement("h4");
                    title.className = "h6 mb-2";
                    title.textContent = titleText;
                    infoBlock.appendChild(title);
                }

                const bodyText = field.text ?? field.content ?? field.description ?? "";
                if (bodyText) {
                    const paragraph = document.createElement("p");
                    paragraph.className = "mb-0 text-muted";
                    const lines = String(bodyText).split("\n");
                    lines.forEach((line, lineIndex) => {
                        if (lineIndex > 0) {
                            paragraph.appendChild(document.createElement("br"));
                        }
                        paragraph.appendChild(document.createTextNode(line));
                    });
                    infoBlock.appendChild(paragraph);
                }

                this.container.appendChild(infoBlock);
                return;
            }

            const wrapper = document.createElement("div");
            wrapper.className = "mb-3";
            wrapper.dataset.fieldWrapper = field.name;

            const fieldId = this._fieldId(field.name);

            if (field.type === "checkbox") {
                const formCheck = document.createElement("div");
                formCheck.className = "form-check";

                const input = document.createElement("input");
                input.type = "checkbox";
                input.name = field.name;
                input.id = fieldId;
                input.className = "form-check-input";
                input.checked = Boolean(this.state[field.name]);
                input.setAttribute("aria-invalid", "false");
                applyInputAttributes(input, field);
                input.addEventListener("change", e => {
                    this._handleFieldChange(stageIndex, field.name, e.target.checked);
                }, { signal });

                const label = document.createElement("label");
                label.className = "form-check-label";
                label.htmlFor = fieldId;
                label.textContent = field.label;

                formCheck.append(input, label);
                wrapper.append(formCheck);
                const helperId = this._appendHelperText(wrapper, field.helperText, field.name);
                if (helperId) {
                    input.setAttribute("aria-describedby", helperId);
                }
                this.container.appendChild(wrapper);
                return;
            }

            const label = document.createElement("label");
            label.textContent = field.label;
            label.htmlFor = fieldId;
            label.className = "form-label";

            if (field.type === "radio") {
                const groupLabelId = this._radioGroupLabelId(field.name);
                label.id = groupLabelId;
                wrapper.append(label);

                const group = document.createElement("div");
                group.className = "d-flex flex-column gap-2";
                group.setAttribute("role", "radiogroup");
                group.setAttribute("aria-labelledby", groupLabelId);

                (field.options ?? []).forEach(opt => {
                    const optionValue = typeof opt === "string" ? opt : opt.value;
                    const optionLabel = typeof opt === "string" ? opt : (opt.label ?? opt.value);
                    const optionId = this._radioOptionId(field.name, optionValue);

                    const formCheck = document.createElement("div");
                    formCheck.className = "form-check";

                    const radio = document.createElement("input");
                    radio.type = "radio";
                    // Scope radio name to prevent cross-form grouping
                    radio.name = this._scopedId(field.name);
                    radio.id = optionId;
                    radio.value = optionValue;
                    radio.className = "form-check-input";
                    radio.checked = this.state[field.name] === optionValue;
                    radio.setAttribute("aria-invalid", "false");
                    radio.addEventListener("change", () => {
                        this._handleFieldChange(stageIndex, field.name, optionValue);
                    }, { signal });

                    const radioLabel = document.createElement("label");
                    radioLabel.className = "form-check-label";
                    radioLabel.htmlFor = optionId;
                    radioLabel.textContent = optionLabel;

                    formCheck.append(radio, radioLabel);
                    group.append(formCheck);
                });

                wrapper.append(group);
                const helperId = this._appendHelperText(wrapper, field.helperText, field.name);
                if (helperId) {
                    group.setAttribute("aria-describedby", helperId);
                }
                this.container.appendChild(wrapper);
                return;
            }

            let input;
            if (field.type === "select") {
                input = document.createElement("select");
                input.className = "form-select";

                const placeholder = document.createElement("option");
                placeholder.value = "";
                placeholder.textContent = "-- בחר --";
                input.appendChild(placeholder);

                (field.options ?? []).forEach(opt => {
                    const optionValue = typeof opt === "string" ? opt : opt.value;
                    const optionLabel = typeof opt === "string" ? opt : (opt.label ?? opt.value);

                    const option = document.createElement("option");
                    option.value = optionValue;
                    option.textContent = optionLabel;
                    input.appendChild(option);
                });
            } else if (field.type === "textarea") {
                input = document.createElement("textarea");
                input.className = "form-control";
                input.rows = field.rows ?? 3;
            } else {
                input = document.createElement("input");
                input.type = field.type;
                input.className = "form-control";
            }

            input.name = field.name;
            input.id = fieldId;
            if (field.required) {
                input.required = true;
            }
            input.value = this.state[field.name] ?? "";
            input.setAttribute("aria-invalid", "false");
            applyInputAttributes(input, field);

            if (controllerFieldSet.has(field.name) && INPUT_EVENT_TYPES.has(field.type)) {
                input.addEventListener("input", e => {
                    this._handleFieldInput(stageIndex, field.name, e.target.value);
                }, { signal });
            }

            input.addEventListener("change", e => {
                this._handleFieldChange(stageIndex, field.name, e.target.value);
            }, { signal });

            wrapper.append(label, input);
            const helperId = this._appendHelperText(wrapper, field.helperText, field.name);
            if (helperId) {
                input.setAttribute("aria-describedby", helperId);
            }
            this.container.appendChild(wrapper);
        });
    }

    // --- Field event handlers ---

    /**
     * Handles field change events (e.g., blur, select change, checkbox change).
     * Updates state, prunes hidden fields, saves draft, and re-renders immediately.
     */
    _handleFieldChange(stageIndex, fieldName, value) {
        this._clearPendingRender(fieldName);
        const focusTarget = this._getActiveFocusTarget();
        this.state[fieldName] = value;
        this._pruneHiddenFields();
        this._saveDraft();
        if (isMultiStage(this.activeSchema)) {
            const nextStageIndex = typeof stageIndex === "number" ? stageIndex : this.currentStage;
            this._renderStage(nextStageIndex, { restoreFocusTarget: focusTarget });
            return;
        }
        this._renderStage(undefined, { restoreFocusTarget: focusTarget });
    }

    /**
     * Handles field input events (e.g., typing in text inputs).
     * Updates state and schedules a debounced re-render to avoid excessive rendering.
     */
    _handleFieldInput(stageIndex, fieldName, value) {
        const focusTarget = this._getActiveFocusTarget();
        this.state[fieldName] = value;
        this._pruneHiddenFields();
        this._saveDraft();
        this._scheduleRender(stageIndex, fieldName, focusTarget);
    }

    _clearPendingRender(fieldName) {
        const timerId = this.pendingRenderTimers.get(fieldName);
        if (timerId) {
            clearTimeout(timerId);
            this.pendingRenderTimers.delete(fieldName);
        }
    }

    _scheduleRender(stageIndex, fieldName, focusTarget = null) {
        this._clearPendingRender(fieldName);
        const nextStageIndex = typeof stageIndex === "number" ? stageIndex : this.currentStage;
        const timerId = setTimeout(() => {
            this.pendingRenderTimers.delete(fieldName);
            if (this.activeSchema && isMultiStage(this.activeSchema)) {
                this._renderStage(nextStageIndex, { restoreFocusTarget: focusTarget });
                return;
            }
            this._renderStage(undefined, { restoreFocusTarget: focusTarget });
        }, RENDER_DEBOUNCE_MS);
        this.pendingRenderTimers.set(fieldName, timerId);
    }

    // --- Error display ---

    _showErrors(errors) {
        this.container.querySelectorAll("[data-field-wrapper]").forEach(wrapper => {
            const fieldName = wrapper.dataset.fieldWrapper;
            wrapper.querySelectorAll(".error").forEach(e => e.remove());
            wrapper.querySelectorAll("input, select, textarea").forEach(control => {
                control.classList.remove("is-invalid");
                control.setAttribute("aria-invalid", "false");
                // Remove error from aria-describedby, keep helper if present
                const helperId = this._helperId(fieldName);
                const helperExists = this.root.querySelector(`#${CSS.escape(helperId)}`);
                if (helperExists) {
                    control.setAttribute("aria-describedby", helperId);
                } else {
                    control.removeAttribute("aria-describedby");
                }
            });
        });

        Object.entries(errors).forEach(([field, message]) => {
            const wrapper = this.container.querySelector(`[data-field-wrapper="${CSS.escape(field)}"]`);
            if (!wrapper) {
                return;
            }

            const errorId = this._errorId(field);
            const helperId = this._helperId(field);
            const helperExists = this.root.querySelector(`#${CSS.escape(helperId)}`);

            wrapper.querySelectorAll("input, select, textarea").forEach(control => {
                control.classList.add("is-invalid");
                control.setAttribute("aria-invalid", "true");
                // Combine error and helper in aria-describedby
                const describedBy = helperExists ? `${errorId} ${helperId}` : errorId;
                control.setAttribute("aria-describedby", describedBy);
            });

            const error = document.createElement("div");
            error.id = errorId;
            error.className = "error invalid-feedback d-block mt-1";
            error.setAttribute("role", "alert");
            error.textContent = message || REQUIRED_MESSAGE;
            wrapper.appendChild(error);
        });
    }

    // --- Navigation helpers ---

    _findStageIndexForField(fieldName) {
        if (!isMultiStage(this.activeSchema)) {
            return 0;
        }

        return this.activeSchema.stages.findIndex(stage =>
            stage.fields.some(field => field.name === fieldName)
        );
    }

    _findFirstErrorStage(errors) {
        if (!isMultiStage(this.activeSchema)) {
            return null;
        }

        return Object.keys(errors).reduce((closestIndex, fieldName) => {
            const stageIndex = this._findStageIndexForField(fieldName);
            if (stageIndex === -1) {
                return closestIndex;
            }
            if (closestIndex === null || stageIndex < closestIndex) {
                return stageIndex;
            }
            return closestIndex;
        }, null);
    }

    // --- Stage rendering ---

    _renderStage(stageIndex, options = {}) {
        if (!this.container || !this.activeSchema) {
            return;
        }

        this._clearSubmitFeedback();

        const { focusOnChange = false, restoreFocusTarget = null } = options;

        // Require explicit stage index — fall back to 0 if not provided
        const targetIndex = typeof stageIndex === "number" ? stageIndex : 0;

        this._pruneHiddenFields();

        if (!isMultiStage(this.activeSchema)) {
            this.currentStage = 0;
            this._renderForm();
            this._showErrors({});
            this._updateStageIndicator(0);
            this._updateNavigationControls(0);
            if (restoreFocusTarget && restoreFocusTarget.version === this.focusVersion) {
                this._restoreFocus(restoreFocusTarget);
            } else if (!this._isActiveElementInScope() && this.lastStageFocusTarget) {
                this._restoreFocus(this.lastStageFocusTarget);
            }
            return;
        }

        const lastIndex = getStageCount(this.activeSchema) - 1;
        const previousStage = this.currentStage;
        this.currentStage = Math.min(Math.max(targetIndex, 0), lastIndex);
        this.furthestStageReached = Math.max(this.furthestStageReached, this.currentStage);
        if (this._isOptionalSummaryStage() && this.currentStage === this._getLastDataStageIndex()) {
            this.furthestStageReached = Math.max(this.furthestStageReached, Math.min(this.currentStage + 1, lastIndex));
        }
        if (this._isSummaryStage(this.currentStage)) {
            this._renderSummaryStage();
        } else {
            this._renderForm(this.currentStage);
        }
        this._showErrors({});
        this._updateStageIndicator(this.currentStage);
        this._updateNavigationControls(this.currentStage);

        if (previousStage === this.currentStage) {
            if (restoreFocusTarget && restoreFocusTarget.version === this.focusVersion) {
                this._restoreFocus(restoreFocusTarget);
            } else if (!this._isActiveElementInScope() && this.lastStageFocusTarget) {
                this._restoreFocus(this.lastStageFocusTarget);
            }
        }

        // Announce stage change to screen readers
        if (previousStage !== this.currentStage) {
            this.lastStageFocusTarget = null;
            if (focusOnChange) {
                this._focusFirstStageElement();
            }
            const stage = this.activeSchema.stages[this.currentStage];
            this._announceToScreenReader(`שלב ${this.currentStage + 1} מתוך ${getStageCount(this.activeSchema)} - ${stage.label}`);
        }
    }

    _updateStageIndicator(stageIndex = 0) {
        if (!this.stageIndicator) {
            return;
        }

        if (!isMultiStage(this.activeSchema)) {
            this.stageIndicator.textContent = "";
            this.stageIndicator.classList.add("d-none");
            return;
        }

        const stage = this.activeSchema.stages[stageIndex];
        this.stageIndicator.classList.remove("d-none");
        this.stageIndicator.innerHTML = "";

        const header = document.createElement("div");
        header.className = "d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2";

        const title = document.createElement("h3");
        title.className = "h4 mb-0";
        title.textContent = stage.label;

        const count = document.createElement("div");
        count.className = "text-muted small";
        count.textContent = `שלב ${stageIndex + 1} מתוך ${getStageCount(this.activeSchema)}`;

        header.append(title, count);

        const steps = document.createElement("div");
        steps.className = "stage-indicator__steps mt-3";
        steps.setAttribute("role", "list");

        this.activeSchema.stages.forEach((stageItem, index) => {
            const step = document.createElement("button");
            step.type = "button";
            step.className = "stage-step";
            step.dataset.stageIndex = String(index);
            step.setAttribute("role", "listitem");
            step.title = stageItem.label;
            step.setAttribute("aria-label", stageItem.label ?? `שלב ${index + 1}`);
            step.textContent = String(index + 1);

            if (index === stageIndex) {
                step.classList.add("stage-step--current");
                step.setAttribute("aria-current", "step");
                step.disabled = true;
            } else if (index < this.furthestStageReached) {
                step.classList.add("stage-step--done");
            } else if (index === this.furthestStageReached) {
                step.classList.add("stage-step--next");
            } else {
                step.classList.add("stage-step--undone");
                step.disabled = true;
                step.setAttribute("aria-disabled", "true");
            }

            steps.appendChild(step);
        });

        this.stageIndicator.append(header, steps);

        if (this.stageIndicatorAbortController) {
            this.stageIndicatorAbortController.abort();
            this.stageIndicatorAbortController = null;
        }
        this.stageIndicatorAbortController = new AbortController();
        const { signal } = this.stageIndicatorAbortController;

        this.stageIndicator.addEventListener("click", event => {
            const target = event.target.closest("[data-stage-index]");
            if (!target || !(target instanceof HTMLButtonElement)) {
                return;
            }

            const targetIndex = Number(target.dataset.stageIndex);
            if (!Number.isInteger(targetIndex)) {
                return;
            }

            if (targetIndex > this.furthestStageReached) {
                return;
            }

            this._renderStage(targetIndex, { focusOnChange: true });
        }, { signal });
    }

    _updateNavigationControls(stageIndex = 0) {
        if (!this.prevButton || !this.nextButton || !this.submitButton) {
            return;
        }

        if (!isMultiStage(this.activeSchema)) {
            this.prevButton.style.display = "none";
            this.nextButton.style.display = "none";
            this.submitButton.style.display = "inline-block";
            return;
        }

        const summaryIndex = this._getSummaryStageIndex();
        const hasSummary = summaryIndex !== -1;
        const isSummary = hasSummary && stageIndex === summaryIndex;
        const lastStageIndex = getStageCount(this.activeSchema) - 1;
        const lastDataStageIndex = this._getLastDataStageIndex();

        this.prevButton.style.display = stageIndex === 0 ? "none" : "inline-block";

        if (isSummary) {
            this.nextButton.style.display = "none";
            this.submitButton.style.display = "inline-block";
            return;
        }

        if (hasSummary && stageIndex === lastDataStageIndex) {
            this.nextButton.style.display = "inline-block";
            this.submitButton.style.display = this._isOptionalSummaryStage() ? "inline-block" : "none";
            return;
        }

        this.nextButton.style.display = stageIndex >= lastStageIndex ? "none" : "inline-block";
        this.submitButton.style.display = stageIndex === lastStageIndex ? "inline-block" : "none";
    }

    // --- Focus management ---

    _isElementInScope(element) {
        if (!(element instanceof HTMLElement)) {
            return false;
        }

        return Boolean(
            (this.container && this.container.contains(element)) ||
            (this.controls && this.controls.contains(element))
        );
    }

    _getStageFocusableElements() {
        const focusableSelector = [
            "input:not([type=\"hidden\"]):not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            "button:not([disabled])",
            "[tabindex]:not([tabindex=\"-1\"])"
        ].join(", ");

        const elements = [];

        if (this.container) {
            elements.push(...this.container.querySelectorAll(focusableSelector));
        }

        if (this.controls) {
            elements.push(...this.controls.querySelectorAll(focusableSelector));
        }

        return elements.filter(element => {
            if (!isElementVisible(element)) {
                return false;
            }

            return !element.closest("[data-plain-text]");
        });
    }

    _handleStageTabCycle(event) {
        if (event.key !== "Tab") {
            return;
        }

        if (!this._isActiveElementInScope()) {
            return;
        }

        const focusables = this._getStageFocusableElements();
        if (!focusables.length) {
            return;
        }

        const activeElement = document.activeElement;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const resolved = resolveFocusableIndex(focusables, activeElement, this.lastStageFocusTarget);
        const isActiveInScope = activeElement instanceof HTMLElement && focusables.includes(activeElement);

        if (resolved.index !== -1 && !isActiveInScope) {
            event.preventDefault();
            const nextIndex = event.shiftKey
                ? (resolved.index > 0 ? resolved.index - 1 : focusables.length - 1)
                : (resolved.index < focusables.length - 1 ? resolved.index + 1 : 0);
            focusables[nextIndex].focus();
            return;
        }

        if (event.shiftKey) {
            if (!isActiveInScope || activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            return;
        }

        if (!isActiveInScope || activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    _focusFirstStageElement() {
        const focusables = this._getStageFocusableElements();
        if (!focusables.length) {
            return;
        }

        focusables[0].focus();
    }

    /**
     * Creates a focus target object from an HTML element.
     * The focus version is used to track focus changes and prevent stale focus restoration.
     */
    _getFocusTargetFromElement(element) {
        if (!(element instanceof HTMLElement)) {
            return null;
        }

        return {
            id: element.id || null,
            name: element.getAttribute("name") || null,
            version: this.focusVersion
        };
    }

    _getActiveFocusTarget() {
        return this._getFocusTargetFromElement(document.activeElement);
    }

    /**
     * Attempts to restore focus to a previously focused element.
     * Tries to match by ID first, then by name attribute, scoped to this instance's root.
     */
    _restoreFocus(target) {
        if (!target) {
            return false;
        }

        if (target.id) {
            const byId = this.root.querySelector(`#${CSS.escape(target.id)}`);
            if (byId && isElementVisible(byId)) {
                byId.focus();
                return true;
            }
        }

        if (target.name && this.container) {
            const byName = this.container.querySelector(`[name="${CSS.escape(target.name)}"]`);
            if (byName && isElementVisible(byName)) {
                byName.focus();
                return true;
            }
        }

        return false;
    }

    _isActiveElementInScope() {
        return this._isElementInScope(document.activeElement) && isElementVisible(document.activeElement);
    }

    // --- Submit ---

    async _handleSubmit() {
        if (!this.activeSchema) {
            return;
        }

        if (this.isSubmitting) {
            return;
        }

        this._clearSubmitFeedback();

        if (isMultiStage(this.activeSchema)) {
            const stageErrors = this._validateStage(this.currentStage);
            if (Object.keys(stageErrors).length) {
                this._showErrors(stageErrors);
                return;
            }
        }

        this._pruneHiddenFields();
        const errors = this._validateStage();
        if (Object.keys(errors).length) {
            const firstErrorStage = this._findFirstErrorStage(errors);
            if (firstErrorStage !== null && firstErrorStage !== this.currentStage) {
                this._renderStage(firstErrorStage, { focusOnChange: true });
            }
            this._showErrors(errors);
            return;
        }

        const payload = this._buildSubmissionPayload();
        await this._postPayload(payload);
    }

    // --- Reset ---

    _resetForm() {
        Object.keys(this.state).forEach(key => delete this.state[key]);
        this._clearDraft();
        this._clearSubmitFeedback();
        this.currentStage = 0;
        this.furthestStageReached = 0;
        this._renderStage(0, { focusOnChange: true });
        this._announceToScreenReader("הטופס אופסן");
    }

    // --- Screen reader ---

    _announceToScreenReader(message) {
        this.liveRegion.textContent = "";
        // Small delay to ensure screen readers pick up the change
        setTimeout(() => {
            this.liveRegion.textContent = message;
        }, 100);
    }

    // --- Dynamic UI creation ---

    _createStageIndicator() {
        if (!this.container) {
            return null;
        }

        const indicator = document.createElement("div");
        indicator.className = "stage-indicator d-none";
        indicator.setAttribute("role", "status");
        this.container.before(indicator);
        return indicator;
    }

    _createControls() {
        if (!this.container) {
            return { controls: null, prevButton: null, nextButton: null, submitButton: null, resetButton: null };
        }

        const controls = document.createElement("div");
        controls.className = "d-flex flex-column flex-sm-row gap-2 mt-4";

        const prevButton = document.createElement("button");
        prevButton.type = "button";
        prevButton.className = "btn btn-outline-secondary flex-fill";
        prevButton.textContent = "חזרה";

        const nextButton = document.createElement("button");
        nextButton.type = "button";
        nextButton.className = "btn btn-primary flex-fill";
        nextButton.textContent = "המשך";

        const submitButton = document.createElement("button");
        submitButton.type = "button";
        submitButton.className = "btn btn-success flex-fill";
        submitButton.textContent = "שליחה";

        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "btn btn-outline-danger flex-fill";
        resetButton.textContent = "איפוס";

        controls.append(prevButton, nextButton, submitButton, resetButton);
        this.container.after(controls);

        return { controls, prevButton, nextButton, submitButton, resetButton };
    }

    // --- Event binding ---

    _bindEvents() {
        if (this.container) {
            this.container.addEventListener("submit", event => {
                event.preventDefault();
                this._handleSubmit();
            });
        }

        if (this.prevButton) {
            this.prevButton.onclick = () => {
                if (!this.activeSchema || !isMultiStage(this.activeSchema)) {
                    return;
                }
                this._renderStage(Math.max(this.currentStage - 1, 0), { focusOnChange: true });
            };
        }

        if (this.nextButton) {
            this.nextButton.onclick = () => {
                if (!this.activeSchema || !isMultiStage(this.activeSchema)) {
                    return;
                }
                const errors = this._validateStage(this.currentStage);
                if (Object.keys(errors).length) {
                    this._showErrors(errors);
                    return;
                }
                this._renderStage(this.currentStage + 1, { focusOnChange: true });
            };
        }

        if (this.submitButton) {
            this.submitButton.onclick = () => this._handleSubmit();
        }

        if (this.resetButton) {
            this.resetButton.onclick = () => {
                if (confirm("האם אתה בטוח שברצונך לאפס את הטופס?")) {
                    this._resetForm();
                }
            };
        }

        // Scoped keydown for tab cycling — only fires when focus is within this instance
        this.root.addEventListener("keydown", event => this._handleStageTabCycle(event));

        // Scoped focusin for focus tracking
        this.root.addEventListener("focusin", event => {
            this.focusVersion += 1;
            const target = event.target;
            if (this._isElementInScope(target)) {
                this.lastStageFocusTarget = this._getFocusTargetFromElement(target);
            } else {
                this.lastStageFocusTarget = null;
            }
        });
    }
}
