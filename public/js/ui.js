// UI Manager - Handles all UI rendering and interactions
class UIManager {
    constructor(schemaManager) {
        this.schemaManager = schemaManager;
        this.stageModal = null;
        this.fieldModal = null;
    }

    init() {
        // Initialize Bootstrap modals
        this.stageModal = new bootstrap.Modal(document.getElementById('stageModal'));
        this.fieldModal = new bootstrap.Modal(document.getElementById('fieldModal'));
    }

    // Render the entire UI
    render() {
        this.renderStages();
        this.renderFields();
        this.updateSchemaInfo();
    }

    // Render stages list
    renderStages() {
        const stagesList = document.getElementById('stagesList');
        const stages = this.schemaManager.schema.stages;

        if (stages.length === 0) {
            stagesList.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-2">No stages yet. Click "Add" to create your first stage.</p>
                </div>
            `;
            return;
        }

        stagesList.innerHTML = stages.map((stage, index) => {
            const isSelected = stage.id === this.schemaManager.selectedStageId;
            return `
                <div class="list-group-item ${isSelected ? 'active' : ''} stage-item"
                     data-stage-id="${stage.id}"
                     data-stage-index="${index}"
                     draggable="true">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="drag-handle" style="cursor: grab; padding-right: 8px;">
                            <i class="bi bi-grip-vertical"></i>
                        </div>
                        <div class="flex-grow-1" style="cursor: pointer;" onclick="ui.selectStage('${stage.id}')">
                            <h6 class="mb-1">${this.escapeHtml(stage.label)}</h6>
                            <small class="${isSelected ? 'text-white-50' : 'text-muted'}">
                                ID: ${stage.id} ${stage.type ? `| Type: ${stage.type}` : ''} | ${stage.fields.length} field(s)
                            </small>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn ${isSelected ? 'btn-light' : 'btn-outline-secondary'}" onclick="ui.openStageEditor('${stage.id}')" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn ${isSelected ? 'btn-light' : 'btn-outline-secondary'}" onclick="ui.duplicateStage('${stage.id}')" title="Duplicate">
                                <i class="bi bi-copy"></i>
                            </button>
                            <button class="btn ${isSelected ? 'btn-light' : 'btn-outline-danger'}" onclick="ui.deleteStage('${stage.id}')" title="Delete">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Add drag and drop event listeners to stages
        this.setupDragAndDrop();
    }

    // Render fields list for selected stage
    renderFields() {
        const fieldsList = document.getElementById('fieldsList');
        const fieldsTitle = document.getElementById('fieldsTitle');
        const addFieldBtn = document.getElementById('addFieldBtn');

        if (!this.schemaManager.selectedStageId) {
            fieldsList.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bi bi-list-ul" style="font-size: 3rem;"></i>
                    <p class="mt-2">Select a stage to view and edit its fields.</p>
                </div>
            `;
            fieldsTitle.textContent = 'Fields';
            addFieldBtn.disabled = true;
            return;
        }

        const stage = this.schemaManager.getStage(this.schemaManager.selectedStageId);
        if (!stage) {
            fieldsList.innerHTML = '<div class="alert alert-danger">Stage not found</div>';
            return;
        }

        fieldsTitle.textContent = `Fields - ${stage.label}`;
        addFieldBtn.disabled = false;

        if (stage.fields.length === 0) {
            fieldsList.innerHTML = `
                <div class="text-center p-4 text-muted">
                    <i class="bi bi-plus-circle" style="font-size: 3rem;"></i>
                    <p class="mt-2">No fields in this stage. Click "Add Field" to create one.</p>
                </div>
            `;
            return;
        }

        fieldsList.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover mb-0">
                    <thead>
                        <tr>
                            <th style="width: 30px;"></th>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Label</th>
                            <th>Required</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="fieldsTableBody">
                        ${stage.fields.map((field, index) => `
                            <tr class="field-row" draggable="true" data-field-name="${field.name}" data-field-index="${index}">
                                <td class="drag-handle-cell">
                                    <i class="bi bi-grip-vertical drag-handle"></i>
                                </td>
                                <td><code>${this.escapeHtml(field.name)}</code></td>
                                <td><span class="badge bg-info">${field.type}</span></td>
                                <td>${this.escapeHtml(field.label || field.title || '-')}</td>
                                <td>${field.required ? '<i class="bi bi-check-circle text-success"></i>' : '-'}</td>
                                <td>
                                    <div class="btn-group btn-group-sm">
                                        <button class="btn btn-outline-primary" onclick="ui.openFieldEditor('${stage.id}', '${field.name}')" title="Edit">
                                            <i class="bi bi-pencil"></i>
                                        </button>
                                        <button class="btn btn-outline-secondary" onclick="ui.duplicateField('${stage.id}', '${field.name}')" title="Duplicate">
                                            <i class="bi bi-copy"></i>
                                        </button>
                                        <button class="btn btn-outline-danger" onclick="ui.deleteField('${stage.id}', '${field.name}')" title="Delete">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Setup drag and drop for fields
        this.setupFieldDragAndDrop();
    }

    // Update schema info
    updateSchemaInfo() {
        const schemaIdInput = document.getElementById('schemaIdInput');
        schemaIdInput.value = this.schemaManager.schema.id;
    }

    // Select stage
    selectStage(stageId) {
        this.schemaManager.selectedStageId = stageId;
        this.renderStages();
        this.renderFields();
    }

    // Open stage editor modal
    openStageEditor(stageId = null) {
        this.schemaManager.editingStageId = stageId;

        const modalTitle = document.getElementById('stageModalTitle');
        const form = document.getElementById('stageForm');
        form.reset();

        if (stageId) {
            const stage = this.schemaManager.getStage(stageId);
            if (stage) {
                modalTitle.textContent = 'Edit Stage';
                document.getElementById('stageId').value = stage.id;
                document.getElementById('stageLabel').value = stage.label;
                document.getElementById('stageType').value = stage.type || '';
            }
        } else {
            modalTitle.textContent = 'Add Stage';
        }

        this.stageModal.show();
    }

    // Save stage
    saveStage() {
        const id = document.getElementById('stageId').value.trim();
        const label = document.getElementById('stageLabel').value.trim();
        const type = document.getElementById('stageType').value.trim();

        if (!id || !label) {
            alert('Stage ID and label are required');
            return;
        }

        try {
            if (this.schemaManager.editingStageId) {
                // Edit existing stage
                this.schemaManager.editStage(this.schemaManager.editingStageId, { id, label, type });
                // Update selected stage if ID changed
                if (this.schemaManager.selectedStageId === this.schemaManager.editingStageId) {
                    this.schemaManager.selectedStageId = id;
                }
            } else {
                // Add new stage
                this.schemaManager.addStage({ id, label, type });
                this.schemaManager.selectedStageId = id;
            }

            this.stageModal.hide();
            this.render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Delete stage
    deleteStage(stageId) {
        if (!confirm('Are you sure you want to delete this stage and all its fields?')) {
            return;
        }

        try {
            this.schemaManager.deleteStage(stageId);
            this.render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Duplicate stage
    duplicateStage(stageId) {
        try {
            const newStage = this.schemaManager.duplicateStage(stageId);
            this.schemaManager.selectedStageId = newStage.id;
            this.render();
            this.showAlert('Stage duplicated successfully', 'success');
        } catch (error) {
            alert(error.message);
        }
    }

    // Open field editor modal
    openFieldEditor(stageId, fieldName = null) {
        this.schemaManager.editingFieldName = fieldName;

        const modalTitle = document.getElementById('fieldModalTitle');
        const container = document.getElementById('fieldEditorContainer');

        let field = null;
        if (fieldName) {
            field = this.schemaManager.getField(stageId, fieldName);
            modalTitle.textContent = 'Edit Field';
        } else {
            modalTitle.textContent = 'Add Field';
            field = { type: 'text' }; // Default type
        }

        // Render field editor form
        container.innerHTML = this.renderFieldEditorForm(field);

        // Set up event listeners for dynamic form
        this.setupFieldEditorListeners();

        this.fieldModal.show();
    }

    // Render field editor form
    renderFieldEditorForm(field) {
        const fieldTypes = [
            'plain text', 'text', 'email', 'tel', 'date', 'number',
            'textarea', 'select', 'radio', 'checkbox'
        ];

        const allFields = this.schemaManager.schema.fields.filter(f => f.name !== field.name);

        return `
            <form id="fieldForm">
                <ul class="nav nav-tabs mb-3" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="basic-tab" data-bs-toggle="tab" data-bs-target="#basic" type="button">Basic</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="validation-tab" data-bs-toggle="tab" data-bs-target="#validation" type="button">Validation</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="advanced-tab" data-bs-toggle="tab" data-bs-target="#advanced" type="button">Advanced</button>
                    </li>
                </ul>

                <div class="tab-content">
                    <!-- Basic Tab -->
                    <div class="tab-pane fade show active" id="basic">
                        <div class="mb-3">
                            <label class="form-label">Field Name *</label>
                            <input type="text" class="form-control" id="fieldName" value="${field.name || ''}" required>
                            <div class="form-text">Unique identifier (e.g., "email", "fullName")</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Field Type *</label>
                            <select class="form-select" id="fieldType" required>
                                ${fieldTypes.map(type => `<option value="${type}" ${field.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                            </select>
                        </div>

                        <div class="mb-3" id="titleField" style="display: none;">
                            <label class="form-label">Title</label>
                            <input type="text" class="form-control" id="fieldTitle" value="${field.title || ''}">
                            <div class="form-text">For plain text fields</div>
                        </div>

                        <div class="mb-3" id="labelField">
                            <label class="form-label">Label</label>
                            <input type="text" class="form-control" id="fieldLabel" value="${field.label || ''}">
                        </div>

                        <div class="mb-3" id="textField" style="display: none;">
                            <label class="form-label">Text Content</label>
                            <textarea class="form-control" id="fieldText" rows="3">${field.text || ''}</textarea>
                            <div class="form-text">For plain text fields</div>
                        </div>

                        <div class="mb-3" id="placeholderField">
                            <label class="form-label">Placeholder</label>
                            <input type="text" class="form-control" id="fieldPlaceholder" value="${field.placeholder || ''}">
                        </div>

                        <div class="mb-3" id="helperTextField">
                            <label class="form-label">Helper Text</label>
                            <input type="text" class="form-control" id="fieldHelperText" value="${field.helperText || ''}">
                        </div>

                        <div class="mb-3" id="rowsField" style="display: none;">
                            <label class="form-label">Rows</label>
                            <input type="number" class="form-control" id="fieldRows" value="${field.rows || 4}" min="1">
                            <div class="form-text">For textarea fields</div>
                        </div>

                        <div class="mb-3" id="optionsField" style="display: none;">
                            <label class="form-label">Options</label>
                            <div id="optionsList"></div>
                            <button type="button" class="btn btn-sm btn-secondary mt-2" onclick="ui.addOption()">
                                <i class="bi bi-plus"></i> Add Option
                            </button>
                            <div class="form-text">For select/radio fields</div>
                        </div>
                    </div>

                    <!-- Validation Tab -->
                    <div class="tab-pane fade" id="validation">
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="fieldRequired" ${field.required ? 'checked' : ''}>
                                <label class="form-check-label" for="fieldRequired">Required Field</label>
                            </div>
                        </div>

                        <div class="mb-3" id="attributesField">
                            <label class="form-label">HTML Attributes</label>
                            <div id="attributesList"></div>
                            <button type="button" class="btn btn-sm btn-secondary mt-2" onclick="ui.addAttribute()">
                                <i class="bi bi-plus"></i> Add Attribute
                            </button>
                            <div class="form-text">e.g., min, max, step, pattern, inputmode</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Error Messages</label>
                            <div id="errorMessagesList"></div>
                            <button type="button" class="btn btn-sm btn-secondary mt-2" onclick="ui.addErrorMessage()">
                                <i class="bi bi-plus"></i> Add Error Message
                            </button>
                            <div class="form-text">e.g., required, emailInvalid, min, max</div>
                        </div>
                    </div>

                    <!-- Advanced Tab -->
                    <div class="tab-pane fade" id="advanced">
                        <div class="mb-3">
                            <label class="form-label">Conditional Display (showIf)</label>
                            <div class="card">
                                <div class="card-body">
                                    <div class="mb-3">
                                        <label class="form-label">Depends on Field</label>
                                        <select class="form-select" id="showIfField">
                                            <option value="">None</option>
                                            ${allFields.map(f => `<option value="${f.name}" ${field.showIf?.field === f.name ? 'selected' : ''}>${f.name} (${f.type})</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-0">
                                        <label class="form-label">Equals Value</label>
                                        <input type="text" class="form-control" id="showIfEquals" value="${field.showIf?.equals ?? ''}">
                                        <div class="form-text">Use "true" or "false" for boolean values</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    // Setup field editor listeners
    setupFieldEditorListeners() {
        const typeSelect = document.getElementById('fieldType');
        typeSelect.addEventListener('change', () => this.updateFieldEditorVisibility());

        // Initial visibility
        this.updateFieldEditorVisibility();

        // Load existing data
        const field = this.schemaManager.editingFieldName
            ? this.schemaManager.getField(this.schemaManager.selectedStageId, this.schemaManager.editingFieldName)
            : {};

        // Load options
        if (field.options) {
            field.options.forEach(opt => this.addOption(opt.label, opt.value));
        }

        // Load attributes
        if (field.attributes) {
            Object.entries(field.attributes).forEach(([key, value]) => this.addAttribute(key, value));
        }

        // Load error messages
        if (field.errorMessages) {
            Object.entries(field.errorMessages).forEach(([key, value]) => this.addErrorMessage(key, value));
        }
    }

    // Update field editor visibility based on type
    updateFieldEditorVisibility() {
        const type = document.getElementById('fieldType').value;

        // Show/hide fields based on type
        document.getElementById('titleField').style.display = type === 'plain text' ? 'block' : 'none';
        document.getElementById('textField').style.display = type === 'plain text' ? 'block' : 'none';
        document.getElementById('labelField').style.display = type === 'plain text' ? 'none' : 'block';
        document.getElementById('placeholderField').style.display = ['text', 'email', 'tel', 'number', 'textarea'].includes(type) ? 'block' : 'none';
        document.getElementById('rowsField').style.display = type === 'textarea' ? 'block' : 'none';
        document.getElementById('optionsField').style.display = ['select', 'radio'].includes(type) ? 'block' : 'none';
    }

    // Add option
    addOption(label = '', value = '') {
        const optionsList = document.getElementById('optionsList');
        const index = optionsList.children.length;

        const optionDiv = document.createElement('div');
        optionDiv.className = 'input-group mb-2';
        optionDiv.innerHTML = `
            <input type="text" class="form-control" placeholder="Label" value="${this.escapeHtml(label)}" data-option-label="${index}">
            <input type="text" class="form-control" placeholder="Value" value="${this.escapeHtml(value)}" data-option-value="${index}">
            <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()">
                <i class="bi bi-trash"></i>
            </button>
        `;

        optionsList.appendChild(optionDiv);
    }

    // Add attribute
    addAttribute(key = '', value = '') {
        const attributesList = document.getElementById('attributesList');
        const index = attributesList.children.length;

        const attrDiv = document.createElement('div');
        attrDiv.className = 'input-group mb-2';
        attrDiv.innerHTML = `
            <input type="text" class="form-control" placeholder="Key (e.g., min)" value="${this.escapeHtml(key)}" data-attr-key="${index}">
            <input type="text" class="form-control" placeholder="Value" value="${this.escapeHtml(value)}" data-attr-value="${index}">
            <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()">
                <i class="bi bi-trash"></i>
            </button>
        `;

        attributesList.appendChild(attrDiv);
    }

    // Add error message
    addErrorMessage(key = '', value = '') {
        const errorMessagesList = document.getElementById('errorMessagesList');
        const index = errorMessagesList.children.length;

        const msgDiv = document.createElement('div');
        msgDiv.className = 'input-group mb-2';
        msgDiv.innerHTML = `
            <input type="text" class="form-control" placeholder="Type (e.g., required)" value="${this.escapeHtml(key)}" data-error-key="${index}">
            <input type="text" class="form-control" placeholder="Message" value="${this.escapeHtml(value)}" data-error-value="${index}">
            <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()">
                <i class="bi bi-trash"></i>
            </button>
        `;

        errorMessagesList.appendChild(msgDiv);
    }

    // Save field
    saveField() {
        const stageId = this.schemaManager.selectedStageId;
        if (!stageId) {
            alert('No stage selected');
            return;
        }

        const fieldData = this.collectFieldData();

        try {
            if (this.schemaManager.editingFieldName) {
                // Edit existing field
                this.schemaManager.editField(stageId, this.schemaManager.editingFieldName, fieldData);
            } else {
                // Add new field
                this.schemaManager.addField(stageId, fieldData);
            }

            this.fieldModal.hide();
            this.render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Collect field data from form
    collectFieldData() {
        const fieldData = {
            name: document.getElementById('fieldName').value.trim(),
            type: document.getElementById('fieldType').value
        };

        // Basic properties
        const title = document.getElementById('fieldTitle')?.value.trim();
        if (title) fieldData.title = title;

        const label = document.getElementById('fieldLabel')?.value.trim();
        if (label) fieldData.label = label;

        const text = document.getElementById('fieldText')?.value.trim();
        if (text) fieldData.text = text;

        const placeholder = document.getElementById('fieldPlaceholder')?.value.trim();
        if (placeholder) fieldData.placeholder = placeholder;

        const helperText = document.getElementById('fieldHelperText')?.value.trim();
        if (helperText) fieldData.helperText = helperText;

        const rows = document.getElementById('fieldRows')?.value;
        if (rows) fieldData.rows = parseInt(rows);

        // Required
        const required = document.getElementById('fieldRequired').checked;
        if (required) fieldData.required = true;

        // Options
        const optionsList = document.getElementById('optionsList');
        if (optionsList && optionsList.children.length > 0) {
            fieldData.options = [];
            Array.from(optionsList.children).forEach((div, index) => {
                const labelInput = div.querySelector(`[data-option-label="${index}"]`);
                const valueInput = div.querySelector(`[data-option-value="${index}"]`);
                if (labelInput && valueInput) {
                    fieldData.options.push({
                        label: labelInput.value.trim(),
                        value: valueInput.value.trim()
                    });
                }
            });
        }

        // Attributes
        const attributesList = document.getElementById('attributesList');
        if (attributesList && attributesList.children.length > 0) {
            fieldData.attributes = {};
            Array.from(attributesList.children).forEach((div, index) => {
                const keyInput = div.querySelector(`[data-attr-key="${index}"]`);
                const valueInput = div.querySelector(`[data-attr-value="${index}"]`);
                if (keyInput && valueInput && keyInput.value.trim()) {
                    let value = valueInput.value.trim();
                    // Try to parse as number
                    if (!isNaN(value) && value !== '') {
                        value = parseFloat(value);
                    }
                    fieldData.attributes[keyInput.value.trim()] = value;
                }
            });
        }

        // Error messages
        const errorMessagesList = document.getElementById('errorMessagesList');
        if (errorMessagesList && errorMessagesList.children.length > 0) {
            fieldData.errorMessages = {};
            Array.from(errorMessagesList.children).forEach((div, index) => {
                const keyInput = div.querySelector(`[data-error-key="${index}"]`);
                const valueInput = div.querySelector(`[data-error-value="${index}"]`);
                if (keyInput && valueInput && keyInput.value.trim()) {
                    fieldData.errorMessages[keyInput.value.trim()] = valueInput.value.trim();
                }
            });
        }

        // ShowIf
        const showIfField = document.getElementById('showIfField').value;
        const showIfEquals = document.getElementById('showIfEquals').value.trim();
        if (showIfField && showIfEquals !== '') {
            let equalsValue = showIfEquals;
            // Convert boolean strings
            if (equalsValue === 'true') equalsValue = true;
            else if (equalsValue === 'false') equalsValue = false;

            fieldData.showIf = {
                field: showIfField,
                equals: equalsValue
            };
        }

        return fieldData;
    }

    // Delete field
    deleteField(stageId, fieldName) {
        if (!confirm('Are you sure you want to delete this field?')) {
            return;
        }

        try {
            this.schemaManager.deleteField(stageId, fieldName);
            this.render();
        } catch (error) {
            alert(error.message);
        }
    }

    // Duplicate field
    duplicateField(stageId, fieldName) {
        try {
            this.schemaManager.duplicateField(stageId, fieldName);
            this.render();
            this.showAlert('Field duplicated successfully', 'success');
        } catch (error) {
            alert(error.message);
        }
    }

    // Utility: Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show alert
    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
        alert.style.zIndex = '9999';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alert);

        // Auto remove after 3 seconds
        setTimeout(() => {
            alert.remove();
        }, 3000);
    }

    // Setup drag and drop for stages
    setupDragAndDrop() {
        const stageItems = document.querySelectorAll('.stage-item');
        let draggedElement = null;
        let draggedIndex = null;

        stageItems.forEach((item, index) => {
            // Drag start
            item.addEventListener('dragstart', (e) => {
                draggedElement = item;
                draggedIndex = parseInt(item.dataset.stageIndex);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.innerHTML);
            });

            // Drag end
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                // Remove all drag-over classes
                stageItems.forEach(i => i.classList.remove('drag-over'));
            });

            // Drag over
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedElement !== item) {
                    item.classList.add('drag-over');
                }
            });

            // Drag enter
            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedElement !== item) {
                    item.classList.add('drag-over');
                }
            });

            // Drag leave
            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over');
            });

            // Drop
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                item.classList.remove('drag-over');

                if (draggedElement !== item) {
                    const dropIndex = parseInt(item.dataset.stageIndex);

                    try {
                        // Reorder stages
                        this.schemaManager.reorderStages(draggedIndex, dropIndex);
                        this.render();
                        this.showAlert('Stage reordered successfully', 'success');
                    } catch (error) {
                        console.error('Reorder error:', error);
                        this.showAlert('Failed to reorder stage: ' + error.message, 'danger');
                    }
                }

                draggedElement = null;
                draggedIndex = null;
            });
        });
    }

    // Setup drag and drop for fields
    setupFieldDragAndDrop() {
        const fieldRows = document.querySelectorAll('.field-row');
        let draggedElement = null;
        let draggedIndex = null;

        fieldRows.forEach((row, index) => {
            // Drag start
            row.addEventListener('dragstart', (e) => {
                draggedElement = row;
                draggedIndex = parseInt(row.dataset.fieldIndex);
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', row.innerHTML);
            });

            // Drag end
            row.addEventListener('dragend', (e) => {
                row.classList.remove('dragging');
                fieldRows.forEach(r => r.classList.remove('drag-over'));
            });

            // Drag over
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                if (draggedElement !== row) {
                    row.classList.add('drag-over');
                }
            });

            // Drag enter
            row.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedElement !== row) {
                    row.classList.add('drag-over');
                }
            });

            // Drag leave
            row.addEventListener('dragleave', (e) => {
                row.classList.remove('drag-over');
            });

            // Drop
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                row.classList.remove('drag-over');

                if (draggedElement !== row) {
                    const dropIndex = parseInt(row.dataset.fieldIndex);
                    const stageId = this.schemaManager.selectedStageId;

                    try {
                        // Reorder fields
                        this.schemaManager.reorderFields(stageId, draggedIndex, dropIndex);
                        this.render();
                        this.showAlert('Field reordered successfully', 'success');
                    } catch (error) {
                        console.error('Reorder error:', error);
                        this.showAlert('Failed to reorder field: ' + error.message, 'danger');
                    }
                }

                draggedElement = null;
                draggedIndex = null;
            });
        });
    }
}
