const fs = require('fs');
const path = require('path');

// Import the swagger configuration
const { specs } = require('../dist/config/swagger');

const main = () => {
  try {
    const outputDir = path.join(__dirname, '..', 'docs');
    
    // Create docs directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Export OpenAPI specification
    const openApiPath = path.join(outputDir, 'openapi.json');
    fs.writeFileSync(openApiPath, JSON.stringify(specs, null, 2));
    console.log(`✅ OpenAPI specification exported: ${openApiPath}`);

    // Also create a YAML version
    const yaml = require('js-yaml');
    const openApiYamlPath = path.join(outputDir, 'openapi.yaml');
    fs.writeFileSync(openApiYamlPath, yaml.dump(specs));
    console.log(`✅ OpenAPI YAML specification exported: ${openApiYamlPath}`);

    console.log('\n📚 Generated documentation files:');
    console.log('- openapi.json (OpenAPI 3.0 specification)');
    console.log('- openapi.yaml (OpenAPI 3.0 specification in YAML)');
    console.log('- AquaFlow-API.postman_collection.json (Postman collection)');
    console.log('- AquaFlow-Environment.postman_environment.json (Postman environment)');
    console.log('- README.md (Documentation guide)');

  } catch (error) {
    console.error('❌ Error exporting OpenAPI spec:', error);
    console.log('\n💡 Make sure to build the project first: npm run build');
    process.exit(1);
  }
};

// Run the script
main();