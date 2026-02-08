// Main Application - Initialize and wire up event handlers
let schemaManager;
let ui;
let formPreview;
let isPreviewVisible = false;

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create instances
    schemaManager = new SchemaManager();
    ui = new UIManager(schemaManager);
    formPreview = new FormPreview(document.getElementById('previewRoot'));

    // Initialize UI
    ui.init();

    // Check for auto-saved data
    checkForAutoSavedData();

    // Start auto-save
    schemaManager.startAutoSave();

    // Set up event handlers
    setupEventHandlers();

    // Save before unload
    window.addEventListener('beforeunload', (e) => {
        if (schemaManager.hasUnsavedChanges) {
            schemaManager.saveToLocalStorage();
        }
    });

    console.log('Form Schema Editor initialized');
});

// Setup all event handlers
function setupEventHandlers() {
    // Toolbar buttons
    document.getElementById('newSchemaBtn').addEventListener('click', handleNewSchema);
    document.getElementById('uploadSchemaInput').addEventListener('change', handleUploadSchema);

    // Download format buttons
    document.getElementById('downloadJsBtn').addEventListener('click', (e) => {
        e.preventDefault();
        handleDownloadSchema('js');
    });
    document.getElementById('downloadJsonBtn').addEventListener('click', (e) => {
        e.preventDefault();
        handleDownloadSchema('json');
    });
    document.getElementById('downloadMinifiedBtn').addEventListener('click', (e) => {
        e.preventDefault();
        handleDownloadSchema('minified');
    });

    // Schema ID input
    document.getElementById('schemaIdInput').addEventListener('change', (e) => {
        schemaManager.updateSchemaId(e.target.value.trim());
    });

    // Lint schema button
    document.getElementById('lintSchemaBtn').addEventListener('click', handleLintSchema);

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

    // Preview toggle button
    document.getElementById('togglePreviewBtn').addEventListener('click', togglePreview);
    document.getElementById('closePreviewBtn').addEventListener('click', hidePreview);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Skip if user is typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Ctrl/Cmd + S to download
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleDownloadSchema('js');
        }

        // Ctrl/Cmd + N to new schema
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            handleNewSchema();
        }

        // Ctrl/Cmd + O to upload
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            document.getElementById('uploadSchemaInput').click();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            // Bootstrap handles modal closing
        }
    });

    // Add keyboard navigation for stages
    document.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.classList.contains('stage-item')) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const stageId = activeElement.dataset.stageId;
                ui.selectStage(stageId);
            }
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
async function handleDownloadSchema(format = 'js') {
    // Validate schema before download
    const errors = schemaManager.validateSchema();
    if (errors.length > 0) {
        const message = 'Schema has validation errors:\n\n' + errors.join('\n');
        if (!confirm(message + '\n\nDownload anyway?')) {
            return;
        }
    }

    try {
        await schemaManager.downloadSchema(format);
        const formatNames = { js: 'JavaScript', json: 'JSON', minified: 'Minified JSON' };
        ui.showAlert(`Schema downloaded as ${formatNames[format]}`, 'success');
    } catch (error) {
        console.error('Download error:', error);
        ui.showAlert('Download failed: ' + error.message, 'danger');
    }
}

// Check for auto-saved data
function checkForAutoSavedData() {
    const saved = schemaManager.loadFromLocalStorage();

    if (saved && saved.schema) {
        const timestamp = new Date(saved.timestamp);
        const timeAgo = getTimeAgo(timestamp);

        if (confirm(`Found auto-saved schema from ${timeAgo}. Would you like to restore it?`)) {
            schemaManager.loadSchema(saved.schema);
            ui.render();
            ui.showAlert('Schema restored from auto-save', 'success');
        } else {
            schemaManager.clearLocalStorage();
        }
    }
}

// Get human-readable time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
}

// Handle lint schema
function handleLintSchema() {
    const issues = schemaManager.lintSchema();
    ui.renderLintResults(issues);

    const total = issues.errors.length + issues.warnings.length + issues.suggestions.length;

    if (total === 0) {
        ui.showToast('No issues found', 'success');
    } else {
        const message = `Found ${issues.errors.length} error(s), ${issues.warnings.length} warning(s), ${issues.suggestions.length} suggestion(s)`;
        ui.showToast(message, issues.errors.length > 0 ? 'danger' : 'warning');
    }
}

// Toggle preview panel
function togglePreview() {
    if (isPreviewVisible) {
        hidePreview();
    } else {
        showPreview();
    }
}

// Show preview panel
function showPreview() {
    const previewPanel = document.getElementById('previewPanel');
    const toggleBtn = document.getElementById('togglePreviewBtn');
    const toggleText = document.getElementById('togglePreviewText');

    previewPanel.classList.remove('d-none');
    toggleText.textContent = 'Hide Preview';
    toggleBtn.querySelector('i').className = 'bi bi-eye-slash';
    isPreviewVisible = true;

    // Update preview with current schema
    updatePreview();
}

// Hide preview panel
function hidePreview() {
    const previewPanel = document.getElementById('previewPanel');
    const toggleBtn = document.getElementById('togglePreviewBtn');
    const toggleText = document.getElementById('togglePreviewText');

    previewPanel.classList.add('d-none');
    toggleText.textContent = 'Show Preview';
    toggleBtn.querySelector('i').className = 'bi bi-eye';
    isPreviewVisible = false;
}

// Update preview with current schema
function updatePreview() {
    if (!isPreviewVisible) return;

    if (schemaManager.schema.stages.length === 0) {
        formPreview.showError('No stages to preview. Create a stage to see the live preview.');
        return;
    }

    // Load schema into preview
    formPreview.loadSchema(schemaManager.schema);
}

// Export for use in HTML onclick handlers
window.ui = ui;
window.updatePreview = updatePreview;
