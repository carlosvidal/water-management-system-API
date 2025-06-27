const fs = require('fs');
const path = require('path');

// Generate Postman collection from OpenAPI spec
const generatePostmanCollection = () => {
  const collection = {
    info: {
      name: "AquaFlow API",
      description: "Water Management System API - Comprehensive solution for condominium water consumption tracking, billing, and management.",
      version: "1.0.0",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{accessToken}}",
          type: "string"
        }
      ]
    },
    variable: [
      {
        key: "baseUrl",
        value: "http://localhost:3000/api",
        type: "string"
      },
      {
        key: "accessToken",
        value: "",
        type: "string"
      },
      {
        key: "refreshToken",
        value: "",
        type: "string"
      }
    ],
    item: [
      {
        name: "Authentication",
        item: [
          {
            name: "Login",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  email: "admin@aquaflow.com",
                  password: "SuperAdmin123!"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/auth/login",
                host: ["{{baseUrl}}"],
                path: ["auth", "login"]
              },
              description: "Authenticate user with email and password to obtain access tokens"
            },
            event: [
              {
                listen: "test",
                script: {
                  exec: [
                    "if (pm.response.status === 'OK') {",
                    "    const jsonData = pm.response.json();",
                    "    if (jsonData.accessToken) {",
                    "        pm.collectionVariables.set('accessToken', jsonData.accessToken);",
                    "    }",
                    "    if (jsonData.refreshToken) {",
                    "        pm.collectionVariables.set('refreshToken', jsonData.refreshToken);",
                    "    }",
                    "}"
                  ]
                }
              }
            ]
          },
          {
            name: "Refresh Token",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  refreshToken: "{{refreshToken}}"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/auth/refresh",
                host: ["{{baseUrl}}"],
                path: ["auth", "refresh"]
              },
              description: "Generate a new access token using a valid refresh token"
            },
            event: [
              {
                listen: "test",
                script: {
                  exec: [
                    "if (pm.response.status === 'OK') {",
                    "    const jsonData = pm.response.json();",
                    "    if (jsonData.accessToken) {",
                    "        pm.collectionVariables.set('accessToken', jsonData.accessToken);",
                    "    }",
                    "}"
                  ]
                }
              }
            ]
          },
          {
            name: "Get Current User",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/auth/me",
                host: ["{{baseUrl}}"],
                path: ["auth", "me"]
              },
              description: "Retrieve the profile information of the authenticated user"
            }
          },
          {
            name: "Logout",
            request: {
              method: "POST",
              header: [],
              url: {
                raw: "{{baseUrl}}/auth/logout",
                host: ["{{baseUrl}}"],
                path: ["auth", "logout"]
              },
              description: "Log out the authenticated user and invalidate the session"
            }
          }
        ]
      },
      {
        name: "Admin - Super Admin Only",
        item: [
          {
            name: "Get All Condominiums",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/admin/condominiums",
                host: ["{{baseUrl}}"],
                path: ["admin", "condominiums"]
              },
              description: "Get list of all condominiums (Super Admin only)"
            }
          },
          {
            name: "Create Condominium",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "Demo Condominium",
                  address: "123 Main Street",
                  city: "Miami",
                  country: "USA",
                  readingDay: 15,
                  planId: "plan-id-here"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/admin/condominiums",
                host: ["{{baseUrl}}"],
                path: ["admin", "condominiums"]
              },
              description: "Create a new condominium (Super Admin only)"
            }
          },
          {
            name: "Get Plans",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/admin/plans",
                host: ["{{baseUrl}}"],
                path: ["admin", "plans"]
              },
              description: "Get all subscription plans"
            }
          },
          {
            name: "Dashboard Metrics",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/admin/dashboard/metrics",
                host: ["{{baseUrl}}"],
                path: ["admin", "dashboard", "metrics"]
              },
              description: "Get system-wide dashboard metrics"
            }
          }
        ]
      },
      {
        name: "Condominiums",
        item: [
          {
            name: "Get Condominium Details",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}"]
              },
              description: "Retrieve detailed information about a specific condominium"
            }
          },
          {
            name: "Get Condominium Blocks",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/blocks",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "blocks"]
              },
              description: "Get all blocks in a condominium"
            }
          },
          {
            name: "Create Block",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "Block A",
                  maxUnits: 20
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/blocks",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "blocks"]
              },
              description: "Create a new block in a condominium"
            }
          },
          {
            name: "Get Condominium Units",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/units",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "units"]
              },
              description: "Get all units in a condominium"
            }
          },
          {
            name: "Create Unit",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "A101",
                  blockId: "{{blockId}}"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/units",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "units"]
              },
              description: "Create a new unit in a block"
            }
          },
          {
            name: "Get Condominium Residents",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/residents",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "residents"]
              },
              description: "Get all residents in a condominium"
            }
          },
          {
            name: "Create Resident",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "John Doe",
                  email: "john.doe@email.com",
                  phone: "+1-555-0123"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/condominiums/{{condominiumId}}/residents",
                host: ["{{baseUrl}}"],
                path: ["condominiums", "{{condominiumId}}", "residents"]
              },
              description: "Create a new resident"
            }
          }
        ]
      },
      {
        name: "Periods",
        item: [
          {
            name: "Get Condominium Periods",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/periods/condominium/{{condominiumId}}",
                host: ["{{baseUrl}}"],
                path: ["periods", "condominium", "{{condominiumId}}"]
              },
              description: "Get all billing periods for a condominium"
            }
          },
          {
            name: "Create Period",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  name: "January 2024",
                  condominiumId: "{{condominiumId}}",
                  startDate: "2024-01-01",
                  endDate: "2024-01-31"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/periods",
                host: ["{{baseUrl}}"],
                path: ["periods"]
              },
              description: "Create a new billing period"
            }
          },
          {
            name: "Get Period Details",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/periods/{{periodId}}",
                host: ["{{baseUrl}}"],
                path: ["periods", "{{periodId}}"]
              },
              description: "Get detailed information about a specific period"
            }
          },
          {
            name: "Create Reading",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  unitId: "{{unitId}}",
                  meterId: "{{meterId}}",
                  value: 1234.5,
                  notes: "Normal reading"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/periods/{{periodId}}/readings",
                host: ["{{baseUrl}}"],
                path: ["periods", "{{periodId}}", "readings"]
              },
              description: "Create a new meter reading for a period"
            }
          },
          {
            name: "Get Period Readings",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/periods/{{periodId}}/readings",
                host: ["{{baseUrl}}"],
                path: ["periods", "{{periodId}}", "readings"]
              },
              description: "Get all readings for a specific period"
            }
          }
        ]
      },
      {
        name: "Bills",
        item: [
          {
            name: "Calculate Bills for Period",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  periodId: "{{periodId}}",
                  condominiumId: "{{condominiumId}}"
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/bills/calculate",
                host: ["{{baseUrl}}"],
                path: ["bills", "calculate"]
              },
              description: "Calculate bills for all units in a period"
            }
          },
          {
            name: "Preview Bill Calculation",
            request: {
              method: "POST",
              header: [
                {
                  key: "Content-Type",
                  value: "application/json"
                }
              ],
              body: {
                mode: "raw",
                raw: JSON.stringify({
                  consumption: 15.5,
                  basicRate: 1.5,
                  fixedCharge: 5.0
                }, null, 2)
              },
              url: {
                raw: "{{baseUrl}}/bills/preview",
                host: ["{{baseUrl}}"],
                path: ["bills", "preview"]
              },
              description: "Preview bill calculation without creating actual bills"
            }
          },
          {
            name: "Get Bills Summary",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/bills/summary/{{periodId}}",
                host: ["{{baseUrl}}"],
                path: ["bills", "summary", "{{periodId}}"]
              },
              description: "Get billing summary for a period"
            }
          },
          {
            name: "Get Period Bills",
            request: {
              method: "GET",
              header: [],
              url: {
                raw: "{{baseUrl}}/bills/period/{{periodId}}",
                host: ["{{baseUrl}}"],
                path: ["bills", "period", "{{periodId}}"]
              },
              description: "Get all bills for a specific period"
            }
          }
        ]
      }
    ]
  };

  // Add additional environment variables
  collection.variable.push(
    {
      key: "condominiumId",
      value: "",
      type: "string"
    },
    {
      key: "blockId", 
      value: "",
      type: "string"
    },
    {
      key: "unitId",
      value: "",
      type: "string"
    },
    {
      key: "periodId",
      value: "",
      type: "string"
    },
    {
      key: "meterId",
      value: "",
      type: "string"
    }
  );

  return collection;
};

// Generate environment file
const generateEnvironment = () => {
  const environment = {
    id: "aquaflow-env",
    name: "AquaFlow Environment",
    values: [
      {
        key: "baseUrl",
        value: "http://localhost:3000/api",
        enabled: true
      },
      {
        key: "accessToken",
        value: "",
        enabled: true
      },
      {
        key: "refreshToken", 
        value: "",
        enabled: true
      },
      {
        key: "condominiumId",
        value: "put-condominium-id-here",
        enabled: true
      },
      {
        key: "blockId",
        value: "put-block-id-here", 
        enabled: true
      },
      {
        key: "unitId",
        value: "put-unit-id-here",
        enabled: true
      },
      {
        key: "periodId",
        value: "put-period-id-here",
        enabled: true
      },
      {
        key: "meterId",
        value: "put-meter-id-here",
        enabled: true
      }
    ],
    _postman_variable_scope: "environment"
  };

  return environment;
};

// Main execution
const main = () => {
  try {
    const outputDir = path.join(__dirname, '..', 'docs');
    
    // Create docs directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate and save Postman collection
    const collection = generatePostmanCollection();
    const collectionPath = path.join(outputDir, 'AquaFlow-API.postman_collection.json');
    fs.writeFileSync(collectionPath, JSON.stringify(collection, null, 2));
    console.log(`✅ Postman collection generated: ${collectionPath}`);

    // Generate and save environment
    const environment = generateEnvironment();
    const environmentPath = path.join(outputDir, 'AquaFlow-Environment.postman_environment.json');
    fs.writeFileSync(environmentPath, JSON.stringify(environment, null, 2));
    console.log(`✅ Postman environment generated: ${environmentPath}`);

    console.log('\n📚 How to use:');
    console.log('1. Import both files into Postman');
    console.log('2. Select the "AquaFlow Environment" in Postman'); 
    console.log('3. Update environment variables with actual IDs from your database');
    console.log('4. Start with the "Login" request to get your access token');
    console.log('5. The access token will be automatically saved for other requests');

  } catch (error) {
    console.error('❌ Error generating Postman files:', error);
    process.exit(1);
  }
};

// Run the script
main();