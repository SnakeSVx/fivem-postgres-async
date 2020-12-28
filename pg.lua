local assert, next, type = assert, next, type

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

local function queryFun(query, callback, params)
    assert(type(query) == "string", "The SQL Query must be a string")
    exports['pg-async']:pg_query(
        query,
        callback,
        safeParameters(params)
    );
end

PgSql.Async.query = queryFun;

function PgSql.Sync.query(query, params)
    local finishedQuery, res, err = false, nil, nil
    queryFun(
        query,
        function(error, result)
            res = result;
            err = error;
            finishedQuery = true;
        end,
        safeParameters(params)
    );
    repeat Citizen.Wait(0) until finishedQuery == true
    return err,res;
end

local function transaction(queries, callback) 
    assert(type(queries) == "table", "The SQL Queries must be in a table")
    exports['pg-async']:pg_transaction(
        queries,
        callback
    );
end

PgSql.Async.transaction = transaction;

function PgSql.Sync.transaction(queries)
    local finishedQuery, res, err = false, nil, nil
    transaction(
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
