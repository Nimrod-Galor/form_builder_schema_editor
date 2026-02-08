// Default fallback messages used when a field does not override copy.
export const REQUIRED_MESSAGE = "שדה חובה";

export function isMultiStage(schema) {
    return Array.isArray(schema.stages) && schema.stages.length > 0;
}

export function getStageCount(schema) {
    return isMultiStage(schema) ? schema.stages.length : 1;
}

export function getFields(schema, stageIndex = null) {
    if (isMultiStage(schema)) {
        if (typeof stageIndex === "number") {
            return schema.stages[stageIndex]?.fields ?? [];
        }
        return schema.fields ?? schema.stages.flatMap(stage => stage.fields);
    }

    return schema.fields ?? [];
}

export function evaluateCondition(condition, state) {
    const value = state[condition.field];
    return value === condition.equals;
}

export function shouldDisplayField(field, state) {
    if (!field?.showIf) {
        return true;
    }

    return evaluateCondition(field.showIf, state);
}

export function getVisibleFields(schema, state, stageIndex = null) {
    return getFields(schema, stageIndex)
        .filter(field => !isPlainTextField(field))
        .filter(field => shouldDisplayField(field, state));
}

export function isPlainTextField(field) {
    const type = String(field?.type ?? "").toLowerCase();
    return type === "plain text" || type === "plaintext";
}
