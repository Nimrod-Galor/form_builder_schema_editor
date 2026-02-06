const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    if (ext !== '.js' && ext !== '.json') {
      return cb(new Error('Only .js and .json files are allowed'));
    }
    cb(null, true);
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload schema file
app.post('/upload', upload.single('schemaFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let fileContent = fs.readFileSync(filePath, 'utf8');

    // Try to extract schema from JavaScript module format
    let schema;
    try {
      // Try to parse as JSON first
      try {
        schema = JSON.parse(fileContent);
        console.log('Parsed as JSON successfully');
      } catch (e) {
        // If not JSON, try to evaluate as JavaScript
        console.log('Not JSON, trying JavaScript evaluation...');

        // Remove export statements
        let cleanContent = fileContent.replace(/export\s+(const|let|var)\s+/g, '$1 ');

        console.log('Clean content preview:', cleanContent.substring(0, 200));

        // Evaluate the entire file to get all variable definitions
        try {
          // Use Function constructor for safer evaluation with explicit return
          const evalFunc = new Function(cleanContent + '; return formSchema;');
          schema = evalFunc();
          console.log('JavaScript evaluation successful');
        } catch (evalError) {
          console.error('Eval error:', evalError);
          console.error('Stack:', evalError.stack);
          throw evalError;
        }
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return res.status(400).json({ error: 'Invalid schema file format: ' + parseError.message });
    }

    // Validate schema structure
    if (!schema || typeof schema !== 'object') {
      return res.status(400).json({ error: 'Invalid schema structure' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ success: true, schema });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download schema file
app.post('/download', (req, res) => {
  try {
    const { schema, format = 'js' } = req.body;

    if (!schema) {
      return res.status(400).json({ error: 'No schema provided' });
    }

    let fileContent, contentType, filename;

    switch (format) {
      case 'json':
        fileContent = JSON.stringify(schema, null, 2);
        contentType = 'application/json';
        filename = `schema.${schema.id || 'export'}.json`;
        break;

      case 'minified':
        fileContent = JSON.stringify(schema);
        contentType = 'application/json';
        filename = `schema.${schema.id || 'export'}.min.json`;
        break;

      case 'js':
      default:
        fileContent = generateSchemaFile(schema);
        contentType = 'application/javascript';
        filename = `schema.${schema.id || 'export'}.js`;
        break;
    }

    // Set headers for file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(fileContent);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate schema file in the correct format
function generateSchemaFile(schema) {
  const { id, stages } = schema;

  // Format stages array
  const stagesStr = JSON.stringify(stages, null, 2)
    .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
    .replace(/"/g, '"') // Keep quotes for strings
    .replace(/\n/g, '\n  '); // Proper indentation

  // Generate file content
  return `const stages = ${stagesStr};

const fields = stages.flatMap(stage => stage.fields);

export const formSchema = {
  id: "${id}",
  stages,
  fields
};
`;
}

// Start server
app.listen(PORT, () => {
  console.log(`Form Builder server running on http://localhost:${PORT}`);
});
