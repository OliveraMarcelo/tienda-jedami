import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Jedami BFF API',
      version: '1.0.0',
      description: 'API para tienda mayorista y minorista Jedami',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            status: { type: 'integer' },
            type: { type: 'string' },
          },
        },
        Variant: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sizeId: { type: 'integer' },
            colorId: { type: 'integer' },
            sizeName: { type: 'string' },
            colorName: { type: 'string' },
            stock: { type: 'integer' },
            retailPrice: { type: 'number', nullable: true },
            wholesalePrice: { type: 'number', nullable: true },
            active: { type: 'boolean' },
          },
        },
        ProductImage: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            url: { type: 'string' },
            sortOrder: { type: 'integer' },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            categoryId: { type: 'integer', nullable: true },
            categoryName: { type: 'string', nullable: true },
            images: { type: 'array', items: { $ref: '#/components/schemas/ProductImage' } },
            variants: { type: 'array', items: { $ref: '#/components/schemas/Variant' } },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            variantId: { type: 'integer', nullable: true },
            productId: { type: 'integer', nullable: true },
            productName: { type: 'string' },
            sizeName: { type: 'string', nullable: true },
            colorName: { type: 'string', nullable: true },
            quantity: { type: 'integer' },
            assignedColorId: { type: 'integer', nullable: true },
            assignedColorName: { type: 'string', nullable: true },
            unitPrice: { type: 'number' },
            subtotal: { type: 'number' },
            fulfilled: { type: 'boolean' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            purchaseType: { type: 'string', enum: ['curva', 'cantidad', 'retail'] },
            status: { type: 'string', enum: ['pending', 'paid', 'rejected', 'cancelled'] },
            totalAmount: { type: 'number' },
            notes: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            items: { type: 'array', items: { $ref: '#/components/schemas/OrderItem' } },
          },
        },
        Banner: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            imageUrl: { type: 'string' },
            linkUrl: { type: 'string', nullable: true },
            sortOrder: { type: 'integer' },
            active: { type: 'boolean' },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            slug: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            email: { type: 'string' },
            name: { type: 'string', nullable: true },
            roles: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Config: {
          type: 'object',
          properties: {
            roles: {
              type: 'array',
              items: {
                type: 'object',
                properties: { id: { type: 'integer' }, name: { type: 'string' } },
              },
            },
            priceModes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  code: { type: 'string' },
                  label: { type: 'string' },
                  icon: { type: 'string', nullable: true },
                },
              },
            },
            purchaseTypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  code: { type: 'string' },
                  label: { type: 'string' },
                  icon: { type: 'string', nullable: true },
                },
              },
            },
            customerTypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  code: { type: 'string' },
                  label: { type: 'string' },
                  icon: { type: 'string', nullable: true },
                },
              },
            },
            paymentGateway: { type: 'string', enum: ['checkout_pro', 'checkout_api'] },
          },
        },
        Branding: {
          type: 'object',
          properties: {
            storeName: { type: 'string', nullable: true },
            primaryColor: { type: 'string', nullable: true },
            secondaryColor: { type: 'string', nullable: true },
            logoUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/modules/**/**.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
