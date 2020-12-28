import { Pool, PoolConfig, QueryConfig, QueryResult } from 'pg';
var format = require('pg-format');

interface CFXCallback {
    (err: Error, result?: QueryResult<any>): void;
  }

// https://node-postgres.com/features/connecting
const config: PoolConfig = {
    connectionString: GetConvar('postgres_connection_string', ''),
    application_name: 'fivem-server',
    max: 20, // set pool max size to 20
    idleTimeoutMillis: 1000, // close idle clients after 1 second
    connectionTimeoutMillis: 1000, // return an error after 1 second if connection could not be established
};

console.log("pg db config", config);

const pool = new Pool(config);

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
});

pool.on('connect', (client) => {
    console.log('new client created')
});

pool.on('acquire', (client) => {
    console.log('new client acquired')
});

pool.on('remove', (client) => {
    console.log('client removed')
});

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

global.exports('pg_format', (query: string, ...args: any[]): string => format(query, ...args));

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
              console.error('Error in transaction', err.stack)
              client.query('ROLLBACK', err => {
                if (err) {
                    console.error('Error rolling back client', err.stack)
                }
                // release the client back to the pool
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
            const execute = function(index) {
                if(queries.length > index) {
                    const element = queries[index];
                    const queryConfig: QueryConfig = {
                        text: element.query,
                        values: element.parameters
                    }
                    client.query(queryConfig)
                        .then(result => {
                            if(element.callback) {
                                element.callback(null, result)
                            }
                            execute(index+1);
                        })
                        .catch(err => shouldAbort(err, element.callback))
                } else {
                    client.query('COMMIT', err => {
                        if (err) {
                            console.error('Error committing transaction', err.stack)
                        }
                        done()
                        callback(err);
                    })
                }
            } 
            execute(0)
        })
    });
});