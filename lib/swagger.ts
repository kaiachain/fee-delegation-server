import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kaia Fee Delegation Service API',
      version: '1.0.0',
      description: 'Fee delegation service for Kaia blockchain that allows DApps to pay gas fees on behalf of users',
      contact: {
        name: 'Kaia Team',
        url: 'https://kaia.io'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    // servers: [
    //   {
    //     url: 'https://gas-fee-delegation.kaia.io',
    //     description: 'Mainnet Production Server'
    //   },
    //   {
    //     url: 'https://gas-fee-delegation-testnet.kaia.io',
    //     description: 'Testnet Server'
    //   },
    //   {
    //     url: 'http://localhost:3000',
    //     description: 'Local Development Server'
    //   }
    // ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'API Key authentication using Bearer token. Format: kaia_[64-character-hex-string]'
        }
      },
      schemas: {
        UserSignedTransaction: {
          type: 'object',
          required: ['raw'],
          properties: {
            raw: {
              type: 'string',
              description: 'RLP-encoded signed transaction',
              example: '0x09f8860585066720b300830186a09469209103b24e6272b33051dfb905fd9e9e2265d08711c37937e080009465e9d8b6069eec1ef3b8bfae57326008b7aec2c9f847f8458207f6a0cb70dc0...'
            }
          }
        },
        FeeDelegationRequest: {
          type: 'object',
          required: ['userSignedTx'],
          properties: {
            userSignedTx: {
              $ref: '#/components/schemas/UserSignedTransaction'
            }
          }
        },
        TransactionReceipt: {
          type: 'object',
          properties: {
            _type: {
              type: 'string',
              example: 'TransactionReceipt'
            },
            blockHash: {
              type: 'string',
              example: '0x2a7ae196f6e7363fe3cfc79132c1d16292d159e231d73b4308f598a3222d1f57'
            },
            blockNumber: {
              type: 'integer',
              example: 191523443
            },
            contractAddress: {
              type: 'string',
              nullable: true,
              example: null
            },
            cumulativeGasUsed: {
              type: 'string',
              example: '31000'
            },
            from: {
              type: 'string',
              example: '0x6C4ED74027ab609f506efCdd224041c9F5b5CDE1'
            },
            gasPrice: {
              type: 'string',
              example: '27500000000'
            },
            gasUsed: {
              type: 'string',
              example: '31000'
            },
            hash: {
              type: 'string',
              example: '0x0ca73736ceecf2dcf0ec2e1f65760d0b4f7348726cb9a0477710172b1dd44350'
            },
            status: {
              type: 'integer',
              description: 'Transaction status: 1 = success, 0 = failed',
              example: 1
            },
            to: {
              type: 'string',
              example: '0x6C4ED74027ab609f506efCdd224041c9F5b5CDE1'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Request was successful'
            },
            data: {
              $ref: '#/components/schemas/TransactionReceipt'
            },
            status: {
              type: 'boolean',
              example: true
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Bad request'
            },
            data: {
              type: 'string',
              example: 'Contract or sender address are not whitelisted'
            },
            error: {
              type: 'string',
              enum: ['BAD_REQUEST', 'INTERNAL_ERROR', 'REVERTED', 'NOT_FOUND'],
              example: 'BAD_REQUEST'
            },
            status: {
              type: 'boolean',
              example: false
            }
          }
        },
        BalanceResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Request was successful'
            },
            data: {
              type: 'boolean',
              description: 'true if sufficient balance, false if insufficient',
              example: true
            },
            status: {
              type: 'boolean',
              example: true
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Fee Delegation',
        description: 'Core fee delegation functionality'
      },
      {
        name: 'Balance',
        description: 'Balance checking and management'
      }
    ]
  },
  apis: ['./app/api/**/route.ts', './app/api/**/*.ts'], // paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);

// Helper function to create Swagger UI HTML
export function createSwaggerUI(specUrl: string) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kaia Fee Delegation API Documentation</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
      <style>
        html {
          box-sizing: border-box;
          overflow: -moz-scrollbars-vertical;
          overflow-y: scroll;
        }
        *, *:before, *:after {
          box-sizing: inherit;
        }
        body {
          margin:0;
          background: #fafafa;
        }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '${specUrl}',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            tryItOutEnabled: true,
            requestInterceptor: (request) => {
              return request;
            },
            responseInterceptor: (response) => {
              return response;
            },
            onComplete: () => {
              // Clear the URL input field after Swagger UI loads
              setTimeout(() => {
                const urlInput = document.querySelector('.download-url-wrapper input[type="text"]');
                if (urlInput) {
                  urlInput.value = '';
                  urlInput.placeholder = 'Enter OpenAPI URL...';
                }
              }, 100);
            }
          });
        };
      </script>
    </body>
    </html>
  `;
}