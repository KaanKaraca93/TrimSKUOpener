// PLM Configuration Template
// Copy this file to plm-config.js and fill in your credentials
// OR set environment variables for production deployment

const PLM_CONFIG = {
    TENANT: process.env.PLM_TENANT || 'YOUR_TENANT_ID',
    TOKEN_URL: process.env.PLM_TOKEN_URL || 'YOUR_TOKEN_URL',
    CLIENT_ID: process.env.PLM_CLIENT_ID || 'YOUR_CLIENT_ID',
    CLIENT_SECRET: process.env.PLM_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    USERNAME: process.env.PLM_USERNAME || 'YOUR_USERNAME',
    PASSWORD: process.env.PLM_PASSWORD || 'YOUR_PASSWORD',
    BASE_API_URL: process.env.PLM_BASE_API_URL || 'YOUR_BASE_API_URL'
};

module.exports = PLM_CONFIG;

