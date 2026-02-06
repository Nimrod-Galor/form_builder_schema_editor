// Schema Manager - Core logic for managing form schema
class SchemaManager {
    constructor() {
        this.schema = {
            id: 'new-form',
            stages: [],
            fields: []
        };
        this.selectedStageId = null;
        this.editingStageId = null;
        this.editingFieldName = null;
        this.autoSaveInterval = null;
        this.hasUnsavedChanges = false;
    }

    // Initialize with a new schema
    createNewSchema() {
        this.schema = {
            id: 'new-form',
            stages: [],
            fields: []
        };
        this.selectedStageId = null;
        this.editingStageId = null;
        this.editingFieldName = null;
        return this.schema;
    }

    // Load schema from object
    loadSchema(schemaData) {
        if (!schemaData || typeof schemaData !== 'object') {
            throw new Error('Invalid schema data');
        }

        this.schema = {
            id: schemaData.id || 'imported-form',
            stages: schemaData.stages || [],
            fields: [] // Will be recalculated
        };

        // Recalculate flattened fields
        this.updateFlattenedFields();
        this.selectedStageId = null;
        this.editingStageId = null;
        this.editingFieldName = null;

        return this.schema;
    }

    // Update flattened fields array
    updateFlattenedFields() {
        this.schema.fields = this.schema.stages.flatMap(stage => stage.fields || []);
    }

    // Update schema ID
    updateSchemaId(id) {
        this.schema.id = id;
        this.markAsChanged();
    }

    // Stage operations
    addStage(stageData) {
        const { id, label, type } = stageData;

        // Validate
        if (!id || !label) {
            throw new Error('Stage ID and label are required');
        }

        // Check for duplicate ID
        if (this.schema.stages.find(s => s.id === id)) {
            throw new Error('Stage ID already exists');
        }

        const newStage = {
            id,
            label,
            ...(type && { type }),
            fields: []
        };

        this.schema.stages.push(newStage);
        this.updateFlattenedFields();
        this.markAsChanged();

        return newStage;
    }

    editStage(stageId, updates) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        // If ID is changing, check for duplicates
        if (updates.id && updates.id !== stageId) {
            if (this.schema.stages.find(s => s.id === updates.id)) {
                throw new Error('Stage ID already exists');
            }
        }

        // Update stage properties
        Object.assign(stage, updates);

        // Clean up undefined/empty type
        if (!stage.type) {
            delete stage.type;
        }

        this.updateFlattenedFields();
        this.markAsChanged();
        return stage;
    }

    deleteStage(stageId) {
        const index = this.schema.stages.findIndex(s => s.id === stageId);
        if (index === -1) {
            throw new Error('Stage not found');
        }

        this.schema.stages.splice(index, 1);
        this.updateFlattenedFields();
        this.markAsChanged();

        if (this.selectedStageId === stageId) {
            this.selectedStageId = null;
        }
    }

    getStage(stageId) {
        return this.schema.stages.find(s => s.id === stageId);
    }

    duplicateStage(stageId) {
        const stage = this.getStage(stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        // Create a copy with a new ID
        let newId = `${stage.id}-copy`;
        let counter = 1;

        // Ensure unique ID
        while (this.schema.stages.find(s => s.id === newId)) {
            counter++;
            newId = `${stage.id}-copy-${counter}`;
        }

        const duplicatedStage = {
            ...stage,
            id: newId,
            label: `${stage.label} (Copy)`,
            fields: stage.fields.map(field => ({ ...field })) // Deep copy fields
        };

        // Insert after the original stage
        const index = this.schema.stages.findIndex(s => s.id === stageId);
        this.schema.stages.splice(index + 1, 0, duplicatedStage);

        this.updateFlattenedFields();
        this.markAsChanged();

        return duplicatedStage;
    }

    reorderStages(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.schema.stages.length ||
            toIndex < 0 || toIndex >= this.schema.stages.length) {
            throw new Error('Invalid stage indices');
        }

        // Remove stage from old position
        const [movedStage] = this.schema.stages.splice(fromIndex, 1);
        // Insert at new position
        this.schema.stages.splice(toIndex, 0, movedStage);

        this.updateFlattenedFields();
        this.markAsChanged();
        return this.schema.stages;
    }

    // Field operations
    addField(stageId, fieldData) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        // Validate required fields
        if (!fieldData.name || !fieldData.type) {
            throw new Error('Field name and type are required');
        }

        // Check for duplicate field name across all stages
        if (this.schema.fields.find(f => f.name === fieldData.name)) {
            throw new Error('Field name already exists');
        }

        // Clean up the field data (remove empty values)
        const cleanField = this.cleanFieldData(fieldData);

        stage.fields.push(cleanField);
        this.updateFlattenedFields();
        this.markAsChanged();

        return cleanField;
    }

    editField(stageId, originalFieldName, fieldData) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        const fieldIndex = stage.fields.findIndex(f => f.name === originalFieldName);
        if (fieldIndex === -1) {
            throw new Error('Field not found');
        }

        // If name is changing, check for duplicates
        if (fieldData.name !== originalFieldName) {
            if (this.schema.fields.find(f => f.name === fieldData.name)) {
                throw new Error('Field name already exists');
            }
        }

        // Clean and update field
        const cleanField = this.cleanFieldData(fieldData);
        stage.fields[fieldIndex] = cleanField;
        this.updateFlattenedFields();
        this.markAsChanged();

        return cleanField;
    }

    deleteField(stageId, fieldName) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        const index = stage.fields.findIndex(f => f.name === fieldName);
        if (index === -1) {
            throw new Error('Field not found');
        }

        stage.fields.splice(index, 1);
        this.updateFlattenedFields();
        this.markAsChanged();
    }

    getField(stageId, fieldName) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) return null;

        return stage.fields.find(f => f.name === fieldName);
    }

    duplicateField(stageId, fieldName) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        const field = stage.fields.find(f => f.name === fieldName);
        if (!field) {
            throw new Error('Field not found');
        }

        // Create a copy with a new name
        let newName = `${field.name}_copy`;
        let counter = 1;

        // Ensure unique name
        while (this.schema.fields.find(f => f.name === newName)) {
            counter++;
            newName = `${field.name}_copy_${counter}`;
        }

        const duplicatedField = {
            ...field,
            name: newName,
            label: field.label ? `${field.label} (Copy)` : undefined
        };

        // Insert after the original field
        const index = stage.fields.findIndex(f => f.name === fieldName);
        stage.fields.splice(index + 1, 0, duplicatedField);

        this.updateFlattenedFields();
        this.markAsChanged();

        return duplicatedField;
    }

    reorderFields(stageId, fromIndex, toIndex) {
        const stage = this.schema.stages.find(s => s.id === stageId);
        if (!stage) {
            throw new Error('Stage not found');
        }

        if (fromIndex < 0 || fromIndex >= stage.fields.length ||
            toIndex < 0 || toIndex >= stage.fields.length) {
            throw new Error('Invalid field indices');
        }

        // Remove field from old position
        const [movedField] = stage.fields.splice(fromIndex, 1);
        // Insert at new position
        stage.fields.splice(toIndex, 0, movedField);

        this.updateFlattenedFields();
        this.markAsChanged();
        return stage.fields;
    }

    // Clean field data - remove empty/undefined values
    cleanFieldData(fieldData) {
        const cleaned = { ...fieldData };

        // Remove empty strings and undefined values
        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === '' || cleaned[key] === undefined) {
                delete cleaned[key];
            }
        });

        // Clean up nested objects
        if (cleaned.attributes && Object.keys(cleaned.attributes).length === 0) {
            delete cleaned.attributes;
        }

        if (cleaned.errorMessages && Object.keys(cleaned.errorMessages).length === 0) {
            delete cleaned.errorMessages;
        }

        if (cleaned.showIf && (!cleaned.showIf.field || cleaned.showIf.equals === undefined)) {
            delete cleaned.showIf;
        }

        if (cleaned.options && cleaned.options.length === 0) {
            delete cleaned.options;
        }

        return cleaned;
    }

    // Upload schema file
    async uploadSchema(file) {
        const formData = new FormData();
        formData.append('schemaFile', file);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }

        return this.loadSchema(result.schema);
    }

    // Download schema
    async downloadSchema(format = 'js') {
        const response = await fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schema: this.schema, format })
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || 'Download failed');
        }

        // Get the file blob and trigger download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Set filename based on format
        const extensions = { js: '.js', json: '.json', minified: '.min.json' };
        a.download = `schema.${this.schema.id}${extensions[format]}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Validation
    validateSchema() {
        const errors = [];

        if (!this.schema.id) {
            errors.push('Schema ID is required');
        }

        if (this.schema.stages.length === 0) {
            errors.push('At least one stage is required');
        }

        this.schema.stages.forEach((stage, stageIndex) => {
            if (!stage.id) {
                errors.push(`Stage ${stageIndex + 1}: ID is required`);
            }
            if (!stage.label) {
                errors.push(`Stage ${stageIndex + 1}: Label is required`);
            }

            stage.fields.forEach((field, fieldIndex) => {
                if (!field.name) {
                    errors.push(`Stage "${stage.label}", Field ${fieldIndex + 1}: Name is required`);
                }
                if (!field.type) {
                    errors.push(`Stage "${stage.label}", Field ${fieldIndex + 1}: Type is required`);
                }

                // Validate showIf references
                if (field.showIf && field.showIf.field) {
                    if (!this.schema.fields.find(f => f.name === field.showIf.field)) {
                        errors.push(`Field "${field.name}": showIf references non-existent field "${field.showIf.field}"`);
                    }
                }

                // Validate options for select/radio
                if ((field.type === 'select' || field.type === 'radio') && (!field.options || field.options.length === 0)) {
                    errors.push(`Field "${field.name}": select/radio fields must have options`);
                }
            });
        });

        return errors;
    }

    // Auto-save functionality
    startAutoSave() {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.saveToLocalStorage();
            }
        }, 30000);

        console.log('Auto-save started');
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('Auto-save stopped');
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('formBuilder_schema', JSON.stringify(this.schema));
            localStorage.setItem('formBuilder_timestamp', new Date().toISOString());
            this.hasUnsavedChanges = false;
            console.log('Schema auto-saved to localStorage');
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const savedSchema = localStorage.getItem('formBuilder_schema');
            const timestamp = localStorage.getItem('formBuilder_timestamp');

            if (savedSchema) {
                const schema = JSON.parse(savedSchema);
                return { schema, timestamp };
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }

        return null;
    }

    clearLocalStorage() {
        try {
            localStorage.removeItem('formBuilder_schema');
            localStorage.removeItem('formBuilder_timestamp');
            console.log('localStorage cleared');
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
    }

    // Schema linting - check for best practices and common issues
    lintSchema() {
        const issues = {
            errors: [],
            warnings: [],
            suggestions: []
        };

        // Check schema ID
        if (!this.schema.id || this.schema.id === 'new-form') {
            issues.warnings.push('Schema ID should be customized');
        }

        if (this.schema.stages.length === 0) {
            issues.errors.push('Schema has no stages');
            return issues;
        }

        // Check each stage
        this.schema.stages.forEach((stage, stageIndex) => {
            const stageLabel = stage.label || `Stage ${stageIndex + 1}`;

            // Check for missing labels
            if (!stage.label) {
                issues.warnings.push(`Stage "${stage.id}" has no label`);
            }

            // Check for empty stages
            if (stage.fields.length === 0) {
                issues.warnings.push(`Stage "${stageLabel}" has no fields`);
            }

            // Check fields in stage
            stage.fields.forEach((field, fieldIndex) => {
                const fieldLabel = field.label || field.name || `Field ${fieldIndex + 1}`;

                // Required field checks
                if (!field.label && !field.title && field.type !== 'plain text') {
                    issues.warnings.push(`Field "${field.name}" in "${stageLabel}" has no label`);
                }

                // Check for missing helper text on complex fields
                if (['email', 'tel', 'number'].includes(field.type) && !field.helperText) {
                    issues.suggestions.push(`Field "${fieldLabel}" in "${stageLabel}" could benefit from helper text`);
                }

                // Check for missing placeholders on input fields
                if (['text', 'email', 'tel', 'number'].includes(field.type) && !field.placeholder) {
                    issues.suggestions.push(`Field "${fieldLabel}" in "${stageLabel}" could have a placeholder`);
                }

                // Check for required fields without error messages
                if (field.required && (!field.errorMessages || !field.errorMessages.required)) {
                    issues.suggestions.push(`Required field "${fieldLabel}" in "${stageLabel}" should have a custom required error message`);
                }

                // Check select/radio without enough options
                if (['select', 'radio'].includes(field.type)) {
                    if (!field.options || field.options.length < 2) {
                        issues.warnings.push(`Field "${fieldLabel}" in "${stageLabel}" should have at least 2 options`);
                    }
                }

                // Check for showIf referencing non-existent fields
                if (field.showIf && field.showIf.field) {
                    const referencedField = this.schema.fields.find(f => f.name === field.showIf.field);
                    if (!referencedField) {
                        issues.errors.push(`Field "${fieldLabel}" in "${stageLabel}" references non-existent field "${field.showIf.field}" in showIf`);
                    } else {
                        // Check if referenced field comes after this field
                        const referencedStage = this.schema.stages.find(s => s.fields.includes(referencedField));
                        const currentStageIndex = this.schema.stages.indexOf(stage);
                        const referencedStageIndex = this.schema.stages.indexOf(referencedStage);

                        if (referencedStageIndex > currentStageIndex) {
                            issues.warnings.push(`Field "${fieldLabel}" depends on "${field.showIf.field}" which appears in a later stage`);
                        } else if (referencedStageIndex === currentStageIndex) {
                            const currentFieldIndex = stage.fields.indexOf(field);
                            const referencedFieldIndex = stage.fields.indexOf(referencedField);
                            if (referencedFieldIndex >= currentFieldIndex) {
                                issues.warnings.push(`Field "${fieldLabel}" depends on "${field.showIf.field}" which appears later in the same stage`);
                            }
                        }
                    }
                }

                // Check number fields for min/max
                if (field.type === 'number' && (!field.attributes || !field.attributes.min || !field.attributes.max)) {
                    issues.suggestions.push(`Number field "${fieldLabel}" in "${stageLabel}" should have min and max attributes`);
                }

                // Check email fields for custom validation error
                if (field.type === 'email' && (!field.errorMessages || !field.errorMessages.emailInvalid)) {
                    issues.suggestions.push(`Email field "${fieldLabel}" in "${stageLabel}" should have a custom emailInvalid error message`);
                }

                // Check tel fields for pattern
                if (field.type === 'tel' && (!field.attributes || !field.attributes.pattern)) {
                    issues.suggestions.push(`Phone field "${fieldLabel}" in "${stageLabel}" should have a pattern attribute for validation`);
                }
            });
        });

        // Check for duplicate stage IDs (shouldn't happen with our validation, but good to check)
        const stageIds = this.schema.stages.map(s => s.id);
        const duplicateStageIds = stageIds.filter((id, index) => stageIds.indexOf(id) !== index);
        if (duplicateStageIds.length > 0) {
            issues.errors.push(`Duplicate stage IDs found: ${duplicateStageIds.join(', ')}`);
        }

        // Check for duplicate field names (shouldn't happen, but good to check)
        const fieldNames = this.schema.fields.map(f => f.name);
        const duplicateFieldNames = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        if (duplicateFieldNames.length > 0) {
            issues.errors.push(`Duplicate field names found: ${duplicateFieldNames.join(', ')}`);
        }

        return issues;
    }
}
