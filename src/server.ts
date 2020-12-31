import { Pool, PoolConfig, QueryConfig, QueryResult } from 'pg';
var format = require('pg-format');

interface CFXCallback {
    (err: Error, result?: QueryResult<any>): void;
}

type Query = {name?: string, query: string, callback?: CFXCallback, parameters?: any};

// https://node-postgres.com/features/connecting
const config: PoolConfig = {
    connectionString: GetConvar('postgres_connection_string', ''),
    application_name: GetConvar('postgres_connection_name', 'fivem-server'),
    max: GetConvarInt('postgres_pool_max', 10), // set pool max size to 10
    idleTimeoutMillis: GetConvarInt('postgres_pool_timeout_idle', 1000), // close idle clients after 1 second
    connectionTimeoutMillis: GetConvarInt('postgres_pool_timeout_connection', 1000), // return an error after 1 second if connection could not be established
};

const pool = new Pool(config);
const libName = 'pg-async'

pool.on('error', (err, client) => {
    console.error(libName, 'Unexpected error on idle client', err)
});

pool.on('connect', (client) => {
    console.log(libName, 'new client created')
});

pool.on('acquire', (client) => {
    console.log(libName, 'new client acquired')
});

pool.on('remove', (client) => {
    console.log(libName, 'client removed')
});

let isReady = false;
global.exports('is_ready', () => isReady);

on('onResourceStart', (resourcename) => {
    if (resourcename === libName) {
      emit('onPostgresReady');
      isReady = true;
    }
  });

on('onResourceStop', (resourcename) => {
    if (resourcename === libName) {
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

global.exports('pg_queries', (queries: Array<Query>): void => {
    queries.forEach(element => {
        const queryConfig: QueryConfig = {
            text: element.query,
            values: element.parameters
        }
        pool.query(queryConfig, element.callback);
    });  
});

global.exports('pg_transactional', (queries: Array<Query>, callback: CFXCallback): void => {
    pool.connect((err, client, done) => {
        const shouldAbort = (err, cb?: CFXCallback) => {
            if (err) {
              console.error(libName, 'Error in transaction', err.stack)
              client.query('ROLLBACK', err => {
                if (err) {
                    console.error(libName, 'Error rolling back client', err.stack)
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
                            console.error(libName, 'Error committing transaction', err.stack)
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

global.exports('pg_transactional_unordered', (queries: Array<Query>, callback: CFXCallback): void => {
    pool.connect((err, client, done) => {
        let transactionDone = false;
        const shouldAbort = (err, cb?: CFXCallback) => {
            if (err) {
                if(!transactionDone) {
                    transactionDone = true;
                    console.error(libName, 'Error in transaction', err.stack)
                    client.query('ROLLBACK', err => {
                        if (err) {
                            console.error(libName, 'Error rolling back client', err.stack)
                        }
                        // release the client back to the pool
                        done()
                        callback(err)
                    })
                }
                if(cb) {
                    cb(err);
                }
            }
            return !!err
        }
        client.query('BEGIN', err => {
            if (shouldAbort(err)) return
            let finished = 0;
            queries.forEach(element => {
                const queryConfig: QueryConfig = {
                    text: element.query,
                    values: element.parameters
                }
                client.query(queryConfig)
                .then(result => {
                    finished = finished + 1;
                    if(!transactionDone && finished === queries.length) {
                        transactionDone = true;
                        client.query('COMMIT', err => {
                            if (err) {
                                console.error(libName, 'Error committing transaction', err.stack)
                            }
                            done()
                            callback(err);
                        })
                    }
                    if(element.callback) {
                        element.callback(null, result)
                    }
                })
                .catch(err => shouldAbort(err, element.callback))
            });
        })
    });
});