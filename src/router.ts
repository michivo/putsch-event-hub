import * as express from 'express';
import { decorateRouter } from '@awaitjs/express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

import healthRouter from './features/health/healthRouter';
import eventRouter from './features/events/eventRouter';

const options: swaggerJSDoc.OAS3Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Product Service API',
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            }
        }
    },
    // we need the ** glob here so the spec works with TS (https://github.com/Surnet/swagger-jsdoc/issues/168)
    apis: ['**/features/**/*Router.ts'], // files containing annotations as above
};

const spec = swaggerJSDoc(options);

// Create async router
// Note: we need 'mergeParams: true' here so we can keep the producerId in the params object
const router = decorateRouter(express.Router({ mergeParams: true }));

router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));

router.use('/api/v1/health', healthRouter);
router.use('/api/v1/events', eventRouter);

export default router;
