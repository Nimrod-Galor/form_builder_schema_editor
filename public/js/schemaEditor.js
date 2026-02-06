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
    async downloadSchema() {
        const response = await fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ schema: this.schema })
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
        a.download = `schema.${this.schema.id}.js`;
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
}
