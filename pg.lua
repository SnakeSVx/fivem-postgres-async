local assert, table, type, pairs = assert, table, type, pairs

PgSql = {
    Async = {},
    Sync = {}
}

local function safeParameters(params)
    if nil == params then
        return nil
    end
    assert(type(params) == "table", "A table is expected")
    return params
end

local function createTransform(callback)
    local cb;
    if callback then
        cb = function(err, result)
            if result then
                callback(err, result.rows)
            else 
                callback(err)
            end
        end
    end
    return cb;
end

local function executeFun(query, callback, params)
    assert(type(query) == "string", "The SQL Query must be a string")
    exports['pg-async']:pg_query(
            query,
            callback,
            safeParameters(params)
    );
end

local function queryFun(query, callback, params)
    executeFun(query, createTransform(callback), params)
end

local function executeAllFun(queries)
    assert(type(queries) == "table", "The queries must be a table")
    exports['pg-async']:pg_queries(
            queries
    );
end

local function queriesFun(queries)
    assert(type(queries) == "table", "The queries must be a table")
    for _, v in pairs(queries) do
        v.callback = createTransform(v.callback)
    end
    executeAllFun(queries)
end

PgSql.Async.execute = executeFun
PgSql.Async.executeAll = executeAllFun
PgSql.Async.query = queryFun;
PgSql.Async.queries = queriesFun;

function PgSql.Sync.query(query, params)
    local finishedQuery, res, err = false, nil, nil
    queryFun(
        query,
        function(error, result)
            RPGF.log.debug(error, result);
            res = result;
            err = error;
            finishedQuery = true;
        end,
        safeParameters(params)
    );
    repeat Citizen.Wait(0) until finishedQuery == true
    return err,res;
end

local function transactional(queries, callback) 
    assert(type(queries) == "table", "The SQL Queries must be in a table")
    exports['pg-async']:pg_transactional(
            queries,
            callback
    );
end

local function transactionalUnordered(queries, callback)
    assert(type(queries) == "table", "The SQL Queries must be in a table")
    exports['pg-async']:pg_transactional_unordered(
            queries,
            callback
    );
end

PgSql.Async.transactional = transactional;
PgSql.Async.transactionalUnordered = transactionalUnordered;

function PgSql.Sync.transactional(queries)
    local finishedQuery, res, err = false, nil, nil
    transactional(
        queries,
        function(error, result)
            res = result;
            err = error;
            finishedQuery = true;
        end
    );
    repeat Citizen.Wait(0) until finishedQuery == true
    return err,res;
end

function PgSql.ready(callback)
    Citizen.CreateThread(function ()
        -- add some more error handling
        while GetResourceState('pg-async') ~= 'started' do
            Citizen.Wait(0)
        end
        while not exports['pg-async']:is_ready() do
            Citizen.Wait(0)
        end
        callback()
    end)
end

function PgSql.format(query, ...)
    return exports['pg-async']:pg_format(query, table.unpack(table.pack(...)))
end
