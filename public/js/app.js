// Main Application - Initialize and wire up event handlers
let schemaManager;
let ui;

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create instances
    schemaManager = new SchemaManager();
    ui = new UIManager(schemaManager);

    // Initialize UI
    ui.init();

    // Set up event handlers
    setupEventHandlers();

    console.log('Form Schema Editor initialized');
});

// Setup all event handlers
function setupEventHandlers() {
    // Toolbar buttons
    document.getElementById('newSchemaBtn').addEventListener('click', handleNewSchema);
    document.getElementById('uploadSchemaInput').addEventListener('change', handleUploadSchema);
    document.getElementById('downloadSchemaBtn').addEventListener('click', handleDownloadSchema);

    // Schema ID input
    document.getElementById('schemaIdInput').addEventListener('change', (e) => {
        schemaManager.updateSchemaId(e.target.value.trim());
    });

    // Stage buttons
    document.getElementById('addStageBtn').addEventListener('click', () => {
        ui.openStageEditor();
    });

    document.getElementById('saveStageBtn').addEventListener('click', () => {
        ui.saveStage();
    });

    // Field buttons
    document.getElementById('addFieldBtn').addEventListener('click', () => {
        ui.openFieldEditor(schemaManager.selectedStageId);
    });

    document.getElementById('saveFieldBtn').addEventListener('click', () => {
        ui.saveField();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S to download
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleDownloadSchema();
        }

        // Ctrl/Cmd + N to new schema
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            handleNewSchema();
        }
    });
}

// Handle new schema
function handleNewSchema() {
    if (schemaManager.schema.stages.length > 0) {
        if (!confirm('Create a new schema? Current work will be lost if not saved.')) {
            return;
        }
    }

    schemaManager.createNewSchema();
    ui.render();
    ui.showAlert('New schema created', 'success');
}

// Handle upload schema
async function handleUploadSchema(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        await schemaManager.uploadSchema(file);
        ui.render();
        ui.showAlert('Schema uploaded successfully', 'success');
    } catch (error) {
        console.error('Upload error:', error);
        ui.showAlert('Upload failed: ' + error.message, 'danger');
    }

    // Reset file input
    e.target.value = '';
}

// Handle download schema
async function handleDownloadSchema() {
    // Validate schema before download
    const errors = schemaManager.validateSchema();
    if (errors.length > 0) {
        const message = 'Schema has validation errors:\n\n' + errors.join('\n');
        if (!confirm(message + '\n\nDownload anyway?')) {
            return;
        }
    }

    try {
        await schemaManager.downloadSchema();
        ui.showAlert('Schema downloaded successfully', 'success');
    } catch (error) {
        console.error('Download error:', error);
        ui.showAlert('Download failed: ' + error.message, 'danger');
    }
}

// Export for use in HTML onclick handlers
window.ui = ui;
