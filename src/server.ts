import { Pool, PoolConfig, QueryConfig, QueryResult } from 'pg';

interface CFXCallback {
    (err: Error, result?: QueryResult<any>): void;
  }

// https://node-postgres.com/features/connecting
const config: PoolConfig = {
    connectionString: GetConvar('postgres_connection_string', ''),
    host: 'localhost',
    database: 'fivem',
    user: 'fivemuser',
    password: 'fivempassword',
    port: 5432,
    ssl: true,
    application_name: 'fivem-server',
    max: 20, // set pool max size to 20
    idleTimeoutMillis: 1000, // close idle clients after 1 second
    connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
};

const pool = new Pool(config);

let isReady = false;
global.exports('is_ready', () => isReady);

on('onResourceStart', (resourcename) => {
    if (resourcename === 'pg-async') {
      emit('onPostgresReady');
      isReady = true;
    }
  });

on('onResourceStop', (resourcename) => {
    if (resourcename === 'pg-async') {
        emit('onPostgresStopped');
        isReady = false;
        pool.end();
    }
});

global.exports('pg_query', (query: string, callback: CFXCallback, parameters?: any): void => {
    const queryConfig: QueryConfig = {
        text: query,
        values: parameters
    }
    pool.query(queryConfig, callback)
});

global.exports('pg_transaction', (queries: Array<{query: string, callback?: CFXCallback, parameters?: any}>, callback: CFXCallback): void => {
    pool.connect((err, client, done) => {
        const shouldAbort = (err, cb?: CFXCallback) => {
            if (err) {
              client.query('ROLLBACK', err => {
                done()
                callback(err)
                if(cb) {
                    cb(err);
                }
              })
            }
            return !!err
        }
        client.query('BEGIN', err => {
            if (shouldAbort(err)) return
            queries.forEach(async element => {
                const queryConfig: QueryConfig = {
                    text: element.query,
                    values: element.parameters
                }
                try {
                    const result = await client.query(queryConfig);
                    if(element.callback) {
                        element.callback(null, result)
                    }
                } catch(err) {
                    if (shouldAbort(err, element.callback)) return
                }
            });
            client.query('COMMIT', err => {
                done()
                callback(err);
            })
        })
    });
});