# fivem-postgres-async

Allows the use of a postgres database on the fivem-server software.

## Usage

1. Download the master of this repository. (Releases might follow later).
2. Extract in resources, make sure the folder name is 'pg-async'
3. Add the following to the server.cfg: ensure pg-async
4. Add the following to the fxmanifest.lua of your own code
   *  dependencies { ..other-deps.., 'pg-async')
   *  server_scripts { '@pg-async/pg.lua', ..your_scripts.. } **
5. Usage
   * PgSql.Sync
     - For synchronous methods
     - query(query_string [, params table])
     - transaction(queries_tables)
       * query: the query to execute
       * (optional) parameters: the parameters to add to the query
       * (optional) callback method (err: string, result: table), See Dependencies for more info
    * PgSql.Async
     - For asynchronous methods
     - query(query_string, callback(error, result) [, params table])
     - transaction(queries_tables, callback(error, result))
       * query: the query to execute
       * (optional) parameters: the parameters to add to the query
       * (optional) callback method (err: string, result: table), See Dependencies for more info  
    * PgSql.ready(callback), will be called when everything is ready
    * PgSql.format (wrapper for pg-format)

## Dependencies

- https://node-postgres.com/
- https://github.com/datalanche/node-pg-format
