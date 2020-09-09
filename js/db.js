
var Database;

module.exports = (function () {

  Database = function(pool) {
    if(!pool) {
      console.log('Invalid Pool.');
    }
    this.pool = pool;
  };

  Database.prototype.Connect = async function() {
    var self = this;

    return await self.pool.connect().catch(err => {
      console.log(err);
    });
  }

  Database.prototype.Query = async function(query, cb, errcb, client) {
    var self = this;

    if(!client) {
      client = await self.Connect();
    }

    var res = await client.query(query)
      .catch((err) => {
        if(typeof(errcb)=='function') {
          errcb(err);
        } else {
          console.log(err)
        }
      });

    if(typeof(cb)=='function') {
      cb(client, res);
    }

    return res;
  }

  Database.prototype.Insert2 = async function(table, data, returning, cb, errcb) {
    var self = this;

    if(typeof(table)!='string') {
      console.log('Invalid table.');
      return null;
    }

    if(typeof(data)!='object') {
      console.log('Invalid data.');
      return null;
    }

    if(typeof(returning)=='function') {
      errcb = cb;
      cb = returning;
      returning = null;
    }

    var insertStr = 'INSERT INTO ';
    var tbl = [];
    var dts = [];

    for(var x in data) {
      //console.log(x, data[x]);
      tbl.push(x);
      dts.push("'"+data[x]+"'");
      console.log('tbl: ',tbl);
      console.log('dts: ',dts);
    }

    insertStr += table+" ("+tbl.join()+")";
    insertStr += " VALUES ("+dts.join()+")";

    if(returning) {
      insertStr += " RETURNING "+returning;
    }

    console.log(insertStr);

    var client = await self.Connect();

    var res = await client.query(insertStr)
      .catch((err) => {

        try {
          client.release();
        } catch(e) {
          console.log(e);
        }

        if(typeof(errcb)=='function') {
          errcb(err, client);
        } else {
          console.log(err)
        }
      });

    if(res) {
      if(typeof(cb)=='function') {
        cb(client, res);
      }

      return res;
    }

    return null;
  }

  Database.prototype.Insert = async function(table, data, returning, cb, errcb, client) {
    var self = this;

    if(typeof(table)!='string') {
      console.log('Invalid table.');
      return null;
    }

    if(typeof(data)!='object') {
      console.log('Invalid data.');
      return null;
    }

    if(typeof(returning)=='function') {
      errcb = cb;
      cb = returning;
      returning = null;
    }

    var insertStr = 'INSERT INTO ';
    var tbl = [];
    var dts = [];
    var val = [];

    var ctr = 1;

    for(var x in data) {
      //console.log(x, data[x]);
      tbl.push(x);
      //dts.push("'"+data[x]+"'");
      dts.push('$'+ctr);
      val.push(data[x]);
      ctr++;
    }

    //console.log('tbl: ',tbl);
    //console.log('dts: ',dts);
    //console.log('val: ',val);

    insertStr += table+" ("+tbl.join()+")";
    insertStr += " VALUES ("+dts.join()+")";

    if(returning) {
      insertStr += " RETURNING "+returning;
    }

    //console.log(insertStr);

    if(!client) {
      client = await self.Connect();
    }

    await client.query("SET client_encoding = 'UTF8'");

    var res = await client.query(insertStr, val)
      .catch((err) => {

        try {
          client.release();
        } catch(e) {
          console.log(e);
        }

        if(typeof(errcb)=='function') {
          errcb(err, client, insertStr);
        } else {
          console.log(err)
        }
      });

    if(res) {
      if(typeof(cb)=='function') {
        cb(client, res);
      }

      return res;
    }

    return null;
  }

  Database.prototype.AccessExclusiveInsert = async function(table, data, returning, cb, errcb) {
    var self = this;

    if(typeof(table)!='string') {
      console.log('Invalid table.');
      return null;
    }

    if(typeof(data)!='object') {
      console.log('Invalid data.');
      return null;
    }

    if(typeof(returning)=='function') {
      errcb = cb;
      cb = returning;
      returning = null;
    }

    var insertStr = 'INSERT INTO ';
    var tbl = [];
    var dts = [];
    var val = [];

    var ctr = 1;

    for(var x in data) {
      //console.log(x, data[x]);
      tbl.push(x);
      //dts.push("'"+data[x]+"'");
      dts.push('$'+ctr);
      val.push(data[x]);
      ctr++;
    }

    //console.log('tbl: ',tbl);
    //console.log('dts: ',dts);
    //console.log('val: ',val);

    insertStr += table+" ("+tbl.join()+")";
    insertStr += " VALUES ("+dts.join()+")";

    if(returning) {
      insertStr += " RETURNING "+returning;
    }

    //console.log(insertStr);

    var client = await self.Connect();

    await client.query('BEGIN');
    await client.query('LOCK TABLE '+table+' IN ACCESS EXCLUSIVE MODE');

    var res = await client.query(insertStr, val)
      .catch((err) => {

        client.query('ROLLBACK');

        try {
          client.release();
        } catch(e) {
          console.log(e);
        }

        if(typeof(errcb)=='function') {
          errcb(err, client);
        } else {
          console.log(err)
        }
      });

    if(res) {

      client.query('COMMIT');

      if(typeof(cb)=='function') {
        cb(client, res);
      }

      return res;
    }

    return null;
  }

  Database.prototype.Update = async function(table, data, where, cb, errcb, client) {
    var self = this;

    if(typeof(table)!='string') {
      console.log('Invalid table.');
      return null;
    }

    if(typeof(data)!='object') {
      console.log('Invalid data.');
      return null;
    }

    if(typeof(where)!='string') {
      console.log('Invalid where condition.');
      return null;
    }

    var updateStr = "UPDATE "+table+" SET ";
    var sets = [];

    for(var x in data) {
      sets.push(x+"='"+data[x]+"'")
    }

    updateStr += sets.join();
    updateStr += " WHERE "+where;

    console.log(sets);
    console.log(updateStr);

    if(!client) {
      var client = await self.Connect();
    }

    var res = await client.query(updateStr)
      .catch((err) => {

        try {
          client.release();
        } catch(e) {
          console.log(e);
        }

        if(typeof(errcb)=='function') {
          errcb(err, client);
        } else {
          console.log(err)
        }
      });

    if(res) {
      if(typeof(cb)=='function') {
        cb(client, res);
      }

      return res;
    }

    return null;
  }

  return Database;

})();
