const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TrimSKUOpener API',
      version: '1.0.0',
      description: 'Excel verilerini okuyup PLM sistemine TrimSKU yazan ve barkod atayan API',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'https://trimskuopener-4b8505224c7d.herokuapp.com',
        description: 'Production server (Heroku)',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        ExcelRequest: {
          type: 'object',
          required: ['url'],
          properties: {
            url: {
              type: 'string',
              description: 'Excel dosyasının URL\'si',
              example: 'https://idm.eu1.inforcloudsuite.com/ca/api/resources/FPLM_Document-90028-2-LATEST?$token=...'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Excel verisi başarıyla işlendi, PLM\'e yazıldı, SKU ID\'leri alındı ve barkodlar atandı'
            },
            data: {
              type: 'object',
              properties: {
                excel: {
                  type: 'object',
                  properties: {
                    totalRows: { type: 'number', example: 9 },
                    processedRows: { type: 'number', example: 9 }
                  }
                },
                plm: {
                  type: 'object',
                  properties: {
                    totalTrims: { type: 'number', example: 1 },
                    successfulTrims: { type: 'number', example: 1 },
                    failedTrims: { type: 'number', example: 0 },
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          trimId: { type: 'number', example: 1558 },
                          trimCode: { type: 'string', example: 'TRFED00069' },
                          skuCount: { type: 'number', example: 9 }
                        }
                      }
                    }
                  }
                },
                skus: {
                  type: 'object',
                  properties: {
                    totalSKUs: { type: 'number', example: 37 },
                    matchedRows: { type: 'number', example: 9 },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', example: 2 },
                          excelData: {
                            type: 'object',
                            properties: {
                              trimCode: { type: 'string', example: 'TRFED00069' },
                              colorCode: { type: 'string', example: '039TY' },
                              sizeCode: { type: 'string', example: '10.5cm' },
                              barcode: { type: 'string', example: 'YeniEge1' }
                            }
                          },
                          plmData: {
                            type: 'object',
                            properties: {
                              trimId: { type: 'number', example: 1558 },
                              trimColorwayId: { type: 'number', example: 7680 },
                              sizeId: { type: 'number', example: 118 },
                              skuId: { type: 'number', example: 76 }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                barcodes: {
                  type: 'object',
                  properties: {
                    total: { type: 'number', example: 9 },
                    successful: { type: 'number', example: 9 },
                    failed: { type: 'number', example: 0 },
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', example: 2 },
                          skuId: { type: 'number', example: 76 },
                          barcode: { type: 'string', example: 'YeniEge1' },
                          status: { type: 'string', example: 'success' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'İşlem sırasında bir hata oluştu'
            },
            error: {
              type: 'string',
              example: 'Hata detayı'
            }
          }
        }
      }
    }
  },
  apis: ['./server.js'],
};

module.exports = swaggerJsdoc(options);

