/**
 * PLM Configuration - BR Entegrasyon için tenant bilgileri
 * Kaynak: BR_Entegrasyon (6).ionapi
 * 
 * Environment variable'lar ile de çalışır (Heroku deployment için)
 */

const PLM_CONFIG = {
    // Tenant bilgileri
    TENANT: process.env.PLM_TENANT || 'JKARFH4LCGZA78A5_PRD',
    
    // OAuth Credentials
    CLIENT_ID: process.env.PLM_CLIENT_ID || 'JKARFH4LCGZA78A5_PRD~v5Lc4NhRCRBgIWqu66v3decDkOnua6U1B2r5cJ8DXpA',
    CLIENT_SECRET: process.env.PLM_CLIENT_SECRET || 'b719ZdA_4L3IV8jcJWoeloGiJBglqafNoAxM14DoZaWHSGrD8GGVvio8JyHP2F-MaYOfgiFIxuapPetzNqKVqA',
    USERNAME: process.env.PLM_USERNAME || 'JKARFH4LCGZA78A5_PRD#ccnfmkpgvjzh4d2W6fZwHMHmnOk8LAw0-awV4iARhQw-v5aQaUSJvdmelk5F4bXM2wPwJY0tbExmUCnU9PQS5w',
    PASSWORD: process.env.PLM_PASSWORD || 'w_bdwXtlE3gSIUxsVtyleZWMmF_0nD6x4jfW2YdbLELcvdaRy5yoc-qxiB65AGVqfDeYaLZMjYWjdFeHDt-4SA',
    
    // API URLs
    TOKEN_URL: process.env.PLM_TOKEN_URL || 'https://mingle-sso.eu1.inforcloudsuite.com:443/JKARFH4LCGZA78A5_PRD/as/token.oauth2',
    ION_API_URL: process.env.PLM_ION_API_URL || 'https://mingle-ionapi.eu1.inforcloudsuite.com',
    BASE_API_URL: process.env.PLM_BASE_API_URL || 'https://mingle-ionapi.eu1.inforcloudsuite.com/JKARFH4LCGZA78A5_PRD/FASHIONPLM'
};

module.exports = PLM_CONFIG;


