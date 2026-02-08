import { FormBuilderBase } from "./formBuilderBase.js";

class FormPreview extends FormBuilderBase {
    async _postPayload(payload) {
        console.log("Preview form data:", payload);
        alert("Form data:\n\n" + JSON.stringify(payload, null, 2));
        return true;
    }

    _bindEvents() {
        super._bindEvents();
        // Override reset to skip confirmation dialog in preview mode
        if (this.resetButton) {
            this.resetButton.onclick = () => this._resetForm();
        }
    }

    loadSchema(schema) {
        if (!schema || !schema.stages) {
            this._displaySchemaError("Invalid schema");
            return;
        }

        this.activeSchema = schema;
        Object.keys(this.state).forEach(key => delete this.state[key]);
        this.currentStage = 0;
        this.furthestStageReached = 0;
        this._renderStage(0);
    }

    showError(message) {
        if (!this.container) {
            return;
        }

        this.container.innerHTML = "";
        const el = document.createElement("div");
        el.className = "alert alert-warning";
        el.setAttribute("role", "alert");
        el.textContent = message;
        this.container.appendChild(el);

        if (this.controls) {
            this.controls.style.display = "none";
        }

        if (this.stageIndicator) {
            this.stageIndicator.classList.add("d-none");
        }
    }
}

window.FormPreview = FormPreview;
