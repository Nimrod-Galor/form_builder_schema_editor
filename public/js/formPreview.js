// Form Preview - Renders live preview of the schema being edited
class FormPreview {
    constructor(containerId, controlsId, stageIndicatorId) {
        this.container = document.getElementById(containerId);
        this.controls = document.getElementById(controlsId);
        this.stageIndicator = document.getElementById(stageIndicatorId);
        this.prevButton = this.controls?.querySelector('#previewPrev');
        this.nextButton = this.controls?.querySelector('#previewNext');
        this.submitButton = this.controls?.querySelector('#previewSubmit');
        this.resetButton = this.controls?.querySelector('#previewReset');

        this.activeSchema = null;
        this.state = {};
        this.currentStage = 0;
        this.furthestStageReached = 0;
        this.formAbortController = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.prevButton) {
            this.prevButton.onclick = () => this.goToPrevStage();
        }

        if (this.nextButton) {
            this.nextButton.onclick = () => this.goToNextStage();
        }

        if (this.submitButton) {
            this.submitButton.onclick = () => this.handleSubmit();
        }

        if (this.resetButton) {
            this.resetButton.onclick = () => this.resetForm();
        }
    }

    // Load and render schema
    loadSchema(schema) {
        if (!schema || !schema.stages) {
            this.showError('Invalid schema');
            return;
        }

        this.activeSchema = schema;
        this.state = {};
        this.currentStage = 0;
        this.furthestStageReached = 0;
        this.renderStage(0);
    }

    // Show error message
    showError(message) {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="alert alert-warning" role="alert">
                <i class="bi bi-exclamation-triangle"></i> ${message}
            </div>
        `;

        if (this.controls) {
            this.controls.style.display = 'none';
        }
    }

    // Check if schema is multi-stage
    isMultiStage() {
        return this.activeSchema && Array.isArray(this.activeSchema.stages) && this.activeSchema.stages.length > 1;
    }

    // Get stage count
    getStageCount() {
        return this.activeSchema?.stages?.length || 0;
    }

    // Get fields for a stage (or all fields if single-stage)
    getFields(stageIndex = null) {
        if (!this.activeSchema) return [];

        if (!this.isMultiStage()) {
            return this.activeSchema.fields || [];
        }

        if (typeof stageIndex === 'number' && this.activeSchema.stages[stageIndex]) {
            return this.activeSchema.stages[stageIndex].fields || [];
        }

        return [];
    }

    // Check if field should be displayed based on showIf
    shouldDisplayField(field) {
        if (!field.showIf || !field.showIf.field) return true;

        const controlValue = this.state[field.showIf.field];
        return controlValue === field.showIf.equals;
    }

    // Render the current stage
    renderStage(stageIndex) {
        if (!this.container || !this.activeSchema) return;

        // Abort previous event listeners
        if (this.formAbortController) {
            this.formAbortController.abort();
        }
        this.formAbortController = new AbortController();
        const { signal } = this.formAbortController;

        // Clear container
        this.container.innerHTML = '';

        this.currentStage = Math.max(0, Math.min(stageIndex, this.getStageCount() - 1));
        this.furthestStageReached = Math.max(this.furthestStageReached, this.currentStage);

        const fields = this.getFields(this.isMultiStage() ? this.currentStage : null);

        // Render each field
        fields.forEach(field => {
            if (!this.shouldDisplayField(field)) return;

            // Plain text field
            if (field.type === 'plain text') {
                const div = document.createElement('div');
                div.className = 'mb-3';

                if (field.title) {
                    const title = document.createElement('h4');
                    title.className = 'h6 mb-2';
                    title.textContent = field.title;
                    div.appendChild(title);
                }

                if (field.text) {
                    const text = document.createElement('p');
                    text.className = 'mb-0 text-muted';
                    text.textContent = field.text;
                    div.appendChild(text);
                }

                this.container.appendChild(div);
                return;
            }

            // Regular form field
            const wrapper = document.createElement('div');
            wrapper.className = 'mb-3';
            wrapper.dataset.fieldWrapper = field.name;

            // Checkbox
            if (field.type === 'checkbox') {
                const formCheck = document.createElement('div');
                formCheck.className = 'form-check';

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = field.name;
                input.id = `preview-${field.name}`;
                input.className = 'form-check-input';
                input.checked = Boolean(this.state[field.name]);

                input.addEventListener('change', (e) => {
                    this.state[field.name] = e.target.checked;
                    this.renderStage(this.currentStage);
                }, { signal });

                const label = document.createElement('label');
                label.className = 'form-check-label';
                label.htmlFor = `preview-${field.name}`;
                label.textContent = field.label || field.name;

                formCheck.append(input, label);
                wrapper.appendChild(formCheck);

                if (field.helperText) {
                    const helper = document.createElement('div');
                    helper.className = 'form-text';
                    helper.textContent = field.helperText;
                    wrapper.appendChild(helper);
                }

                this.container.appendChild(wrapper);
                return;
            }

            // Radio buttons
            if (field.type === 'radio') {
                const label = document.createElement('label');
                label.className = 'form-label';
                label.textContent = field.label || field.name;
                wrapper.appendChild(label);

                const group = document.createElement('div');
                group.className = 'd-flex flex-column gap-2';

                (field.options || []).forEach(opt => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);

                    const formCheck = document.createElement('div');
                    formCheck.className = 'form-check';

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = `preview-${field.name}`;
                    radio.id = `preview-${field.name}-${optValue}`;
                    radio.value = optValue;
                    radio.className = 'form-check-input';
                    radio.checked = this.state[field.name] === optValue;

                    radio.addEventListener('change', () => {
                        this.state[field.name] = optValue;
                        this.renderStage(this.currentStage);
                    }, { signal });

                    const radioLabel = document.createElement('label');
                    radioLabel.className = 'form-check-label';
                    radioLabel.htmlFor = `preview-${field.name}-${optValue}`;
                    radioLabel.textContent = optLabel;

                    formCheck.append(radio, radioLabel);
                    group.appendChild(formCheck);
                });

                wrapper.appendChild(group);

                if (field.helperText) {
                    const helper = document.createElement('div');
                    helper.className = 'form-text';
                    helper.textContent = field.helperText;
                    wrapper.appendChild(helper);
                }

                this.container.appendChild(wrapper);
                return;
            }

            // Label for other fields
            const label = document.createElement('label');
            label.className = 'form-label';
            label.htmlFor = `preview-${field.name}`;
            label.textContent = field.label || field.name;
            if (field.required) {
                label.innerHTML += ' <span class="text-danger">*</span>';
            }

            // Create input element
            let input;
            if (field.type === 'select') {
                input = document.createElement('select');
                input.className = 'form-select';

                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = '-- Select --';
                input.appendChild(placeholder);

                (field.options || []).forEach(opt => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);

                    const option = document.createElement('option');
                    option.value = optValue;
                    option.textContent = optLabel;
                    input.appendChild(option);
                });
            } else if (field.type === 'textarea') {
                input = document.createElement('textarea');
                input.className = 'form-control';
                input.rows = field.rows || 3;
            } else {
                input = document.createElement('input');
                input.type = field.type;
                input.className = 'form-control';
            }

            input.name = field.name;
            input.id = `preview-${field.name}`;
            if (field.required) input.required = true;
            if (field.placeholder) input.placeholder = field.placeholder;
            input.value = this.state[field.name] || '';

            // Apply custom attributes
            if (field.attributes) {
                Object.entries(field.attributes).forEach(([attr, value]) => {
                    if (value !== undefined && value !== null) {
                        input.setAttribute(attr, value);
                    }
                });
            }

            // Add change listener
            input.addEventListener('change', (e) => {
                this.state[field.name] = e.target.value;
                this.renderStage(this.currentStage);
            }, { signal });

            wrapper.append(label, input);

            if (field.helperText) {
                const helper = document.createElement('div');
                helper.className = 'form-text';
                helper.textContent = field.helperText;
                wrapper.appendChild(helper);
            }

            this.container.appendChild(wrapper);
        });

        // Update stage indicator and controls
        this.updateStageIndicator();
        this.updateControls();
    }

    // Update stage indicator
    updateStageIndicator() {
        if (!this.stageIndicator) return;

        if (!this.isMultiStage()) {
            this.stageIndicator.innerHTML = '';
            this.stageIndicator.classList.add('d-none');
            return;
        }

        this.stageIndicator.classList.remove('d-none');

        const stage = this.activeSchema.stages[this.currentStage];

        this.stageIndicator.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h4 class="h6 mb-0">${stage.label || `Stage ${this.currentStage + 1}`}</h4>
                <small class="text-muted">Stage ${this.currentStage + 1} of ${this.getStageCount()}</small>
            </div>
            <div class="progress" style="height: 8px;">
                <div class="progress-bar" role="progressbar"
                     style="width: ${((this.currentStage + 1) / this.getStageCount()) * 100}%"
                     aria-valuenow="${this.currentStage + 1}"
                     aria-valuemin="0"
                     aria-valuemax="${this.getStageCount()}"></div>
            </div>
        `;
    }

    // Update navigation controls
    updateControls() {
        if (!this.controls) return;

        this.controls.style.display = 'flex';

        if (!this.isMultiStage()) {
            if (this.prevButton) this.prevButton.style.display = 'none';
            if (this.nextButton) this.nextButton.style.display = 'none';
            if (this.submitButton) this.submitButton.style.display = 'inline-block';
            return;
        }

        const isFirstStage = this.currentStage === 0;
        const isLastStage = this.currentStage === this.getStageCount() - 1;

        if (this.prevButton) {
            this.prevButton.style.display = isFirstStage ? 'none' : 'inline-block';
        }

        if (this.nextButton) {
            this.nextButton.style.display = isLastStage ? 'none' : 'inline-block';
        }

        if (this.submitButton) {
            this.submitButton.style.display = isLastStage ? 'inline-block' : 'none';
        }
    }

    // Navigation methods
    goToPrevStage() {
        if (this.currentStage > 0) {
            this.renderStage(this.currentStage - 1);
        }
    }

    goToNextStage() {
        if (this.currentStage < this.getStageCount() - 1) {
            this.renderStage(this.currentStage + 1);
        }
    }

    handleSubmit() {
        // In preview mode, just show the collected data
        console.log('Preview form data:', this.state);
        alert('Preview Mode: Form would be submitted with data:\n\n' + JSON.stringify(this.state, null, 2));
    }

    resetForm() {
        this.state = {};
        this.currentStage = 0;
        this.furthestStageReached = 0;
        this.renderStage(0);
    }
}
