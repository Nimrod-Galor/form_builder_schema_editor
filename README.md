# Form Schema Editor

A web-based visual editor for creating and managing multi-step form schemas. Build complex forms with conditional fields, validation rules, and multiple field types through an intuitive drag-and-drop interface.

![Form Schema Editor](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Schema Management
- ✅ **Create & Edit Schemas** - Visual interface for building form schemas
- ✅ **Upload & Download** - Import existing schemas (.js, .json) or export your work
- ✅ **Auto-Save** - Automatic saving to localStorage every 30 seconds
- ✅ **Multiple Export Formats** - Download as JavaScript, JSON, or Minified JSON

### Form Builder
- ✅ **Multi-Stage Forms** - Create complex multi-step forms with multiple stages
- ✅ **10+ Field Types** - Plain text, text, email, tel, date, number, textarea, select, radio, checkbox
- ✅ **Drag & Drop Reordering** - Reorder stages and fields with drag-and-drop
- ✅ **Conditional Fields** - Show/hide fields based on other field values (showIf)
- ✅ **Field Validation** - Required fields, min/max values, patterns, custom error messages
- ✅ **Custom Attributes** - Add HTML attributes like inputmode, pattern, min, max, step

### Live Preview
- ✅ **Real-Time Preview** - See your form as you build it
- ✅ **Interactive** - Test field interactions and conditional visibility
- ✅ **Multi-Stage Navigation** - Navigate through stages in the preview
- ✅ **Toggle On/Off** - Show/hide preview panel as needed

### Quality Tools
- ✅ **Schema Linting** - Comprehensive validation with errors, warnings, and suggestions
- ✅ **Duplicate Stage/Field** - Quick duplication for similar items
- ✅ **Field Type Icons** - Visual indicators for field types
- ✅ **Accessibility** - ARIA labels, keyboard navigation, screen reader support

## Installation

### Prerequisites
- Node.js 14.0 or higher
- npm or yarn

### Setup

1. **Clone or download the project**
   ```bash
   cd FORM-BUILDER-SCHEMA-EDITOR
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

## Usage

### Getting Started

1. **Create a New Schema**
   - Click "New Schema" or upload an existing schema file
   - Set a unique Schema ID in the left panel

2. **Add Stages**
   - Click "Add" in the Stages panel
   - Provide a unique ID and label
   - Optionally set a stage type (e.g., "summary")

3. **Add Fields**
   - Select a stage from the list
   - Click "Add Field" to create a new field
   - Configure field properties in the modal:
     - **Basic**: Name, type, label, placeholder, helper text
     - **Validation**: Required, attributes, error messages
     - **Advanced**: Conditional display (showIf)

4. **Reorder Items**
   - Drag stages or fields to reorder them

5. **Preview Your Form**
   - Click "Show Preview" to see the live form
   - Interact with fields to test conditional logic

6. **Download Schema**
   - Click "Download Schema" and choose format:
     - JavaScript (.js) - ES6 module format
     - JSON (.json) - Standard JSON format
     - Minified JSON - Compact version

### Keyboard Shortcuts

- `Ctrl/Cmd + S` - Download schema as JavaScript
- `Ctrl/Cmd + N` - Create new schema
- `Ctrl/Cmd + O` - Upload schema
- `Escape` - Close modals

### Field Types

| Type | Description | Use Case |
|------|-------------|----------|
| **plain text** | Static informational text | Instructions, headings |
| **text** | Single-line text input | Name, address |
| **email** | Email input with validation | Email address |
| **tel** | Phone number input | Phone numbers |
| **date** | Date picker | Birthdate, appointment date |
| **number** | Numeric input with min/max | Age, quantity |
| **textarea** | Multi-line text input | Comments, feedback |
| **select** | Dropdown selection | Country, category |
| **radio** | Single choice from options | Gender, yes/no |
| **checkbox** | Boolean on/off | Agree to terms |

### Conditional Fields (showIf)

Show/hide fields based on other field values:

```javascript
{
  name: "additionalInfo",
  type: "textarea",
  label: "Additional Information",
  showIf: {
    field: "needsMore",      // The controlling field
    equals: true             // Show when this field equals this value
  }
}
```

### Custom Validation

Add validation attributes and custom error messages:

```javascript
{
  name: "age",
  type: "number",
  label: "Age",
  required: true,
  attributes: {
    min: 18,
    max: 120,
    step: 1
  },
  errorMessages: {
    required: "Please enter your age",
    min: "You must be at least 18",
    max: "Please enter a valid age"
  }
}
```

## Project Structure

```
FORM-BUILDER-SCHEMA-EDITOR/
├── server.js                 # Express server
├── package.json
├── README.md
├── public/                   # Static files served to browser
│   ├── index.html           # Main HTML page
│   ├── css/
│   │   └── styles.css       # Custom styles
│   └── js/
│       ├── app.js           # Application initialization & event handlers
│       ├── schemaEditor.js  # Schema management logic (SchemaManager class)
│       ├── ui.js            # UI rendering & interactions (UIManager class)
│       └── formPreview.js   # Live preview renderer (FormPreview class)
└── uploads/                 # Temporary upload directory
```

## Schema Format

The editor generates schemas in this format:

```javascript
export const formSchema = {
  id: "my-form",
  stages: [
    {
      id: "stage1",
      label: "Stage 1",
      type: "optional-type",
      fields: [
        {
          name: "fieldName",
          type: "text",
          label: "Field Label",
          required: true,
          placeholder: "Enter text...",
          helperText: "Additional help text",
          attributes: { /* HTML attributes */ },
          errorMessages: { /* Custom error messages */ },
          showIf: { /* Conditional display */ }
        }
      ]
    }
  ],
  fields: [ /* Flattened array of all fields */ ]
};
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve main editor page |
| POST | `/upload` | Upload and parse schema file |
| POST | `/download` | Generate schema file for download |

## Technologies Used

### Backend
- **Express.js** - Web server framework
- **Multer** - File upload handling

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Bootstrap 5** - UI components and styling
- **Bootstrap Icons** - Icon library

### Browser APIs
- **LocalStorage** - Auto-save functionality
- **Drag and Drop API** - Reordering functionality
- **File API** - File upload/download

## Development

### File Organization

- **server.js** - Server configuration and API endpoints
- **schemaEditor.js** - Core schema management (add/edit/delete stages & fields)
- **ui.js** - UI rendering, modals, drag-and-drop
- **formPreview.js** - Live preview rendering
- **app.js** - Initialization, event handlers, preview toggle

### Adding New Field Types

1. Add field type to the list in `ui.js` (renderFieldEditorForm)
2. Add icon mapping in `ui.js` (getFieldTypeIcon)
3. Add rendering logic in `formPreview.js` (renderStage)
4. Update documentation

### Extending Validation

Add validation rules in `schemaEditor.js`:
- `validateSchema()` - Basic validation
- `lintSchema()` - Best practices and suggestions

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## Credits

Built with ❤️ using Claude Code by Anthropic
