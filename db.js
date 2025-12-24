const { Pool } = require('pg');

// PostgreSQL bağlantı pool'u
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Database connection test
pool.on('connect', () => {
    console.log('✅ PostgreSQL bağlantısı başarılı');
});

pool.on('error', (err) => {
    console.error('❌ PostgreSQL bağlantı hatası:', err);
});

/**
 * Database schema'yı oluştur
 * Heroku Postgres otomatik oluşturmaz, manuel çalıştırmalıyız
 */
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        console.log('🔧 Database schema kontrol ediliyor...');
        
        // Jobs tablosu
        await client.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id VARCHAR(50) PRIMARY KEY,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                
                -- Input data
                xml_data TEXT,
                excel_url TEXT,
                item_id VARCHAR(50),
                doc_type VARCHAR(100),
                
                -- Progress tracking
                total_rows INTEGER DEFAULT 0,
                processed_rows INTEGER DEFAULT 0,
                current_step VARCHAR(100),
                
                -- Result data
                result JSONB,
                error TEXT
            );
        `);
        
        // Index'ler
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_jobs_status 
            ON jobs(status);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_jobs_created_at 
            ON jobs(created_at DESC);
        `);
        
        console.log('✅ Database schema hazır');
        
    } catch (error) {
        console.error('❌ Database initialization hatası:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Job oluştur
 */
async function createJob(jobId, xmlData, excelUrl, itemId, docType) {
    const result = await pool.query(
        `INSERT INTO jobs (id, status, xml_data, excel_url, item_id, doc_type) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [jobId, 'pending', xmlData, excelUrl, itemId, docType]
    );
    return result.rows[0];
}

/**
 * Job durumunu güncelle
 */
async function updateJobStatus(jobId, status, updates = {}) {
    const fields = ['status = $2', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [jobId, status];
    let paramIndex = 3;
    
    if (updates.startedAt) {
        fields.push(`started_at = $${paramIndex++}`);
        values.push(updates.startedAt);
    }
    
    if (updates.completedAt) {
        fields.push(`completed_at = $${paramIndex++}`);
        values.push(updates.completedAt);
    }
    
    if (updates.currentStep) {
        fields.push(`current_step = $${paramIndex++}`);
        values.push(updates.currentStep);
    }
    
    if (updates.totalRows !== undefined) {
        fields.push(`total_rows = $${paramIndex++}`);
        values.push(updates.totalRows);
    }
    
    if (updates.processedRows !== undefined) {
        fields.push(`processed_rows = $${paramIndex++}`);
        values.push(updates.processedRows);
    }
    
    if (updates.result) {
        fields.push(`result = $${paramIndex++}`);
        values.push(JSON.stringify(updates.result));
    }
    
    if (updates.error) {
        fields.push(`error = $${paramIndex++}`);
        values.push(updates.error);
    }
    
    const query = `UPDATE jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Job bilgisini getir
 */
async function getJob(jobId) {
    const result = await pool.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    return result.rows[0];
}

/**
 * Pending job'ları getir (worker için)
 */
async function getPendingJobs(limit = 10) {
    const result = await pool.query(
        `SELECT * FROM jobs 
         WHERE status = 'pending' 
         ORDER BY created_at ASC 
         LIMIT $1`,
        [limit]
    );
    return result.rows;
}

/**
 * Job'u processing olarak işaretle
 */
async function markJobAsProcessing(jobId) {
    return updateJobStatus(jobId, 'processing', {
        startedAt: new Date(),
        currentStep: 'Starting...'
    });
}

/**
 * Pool'u kapat (graceful shutdown için)
 */
async function closePool() {
    await pool.end();
    console.log('🔌 PostgreSQL bağlantısı kapatıldı');
}

module.exports = {
    pool,
    initializeDatabase,
    createJob,
    updateJobStatus,
    getJob,
    getPendingJobs,
    markJobAsProcessing,
    closePool
};

