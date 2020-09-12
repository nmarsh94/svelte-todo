import sqlite3

DB_PATH = './db.db'
NOTSTARTED = 'Not Started'
INPROGRESS = 'In Progress'
COMPLETED = 'Completed'

import json
import collections

def add_to_list(item):
    try:
        conn = sqlite3.connect(DB_PATH)

        # Once a connection has been established, we use the cursor
        # object to execute queries
        c = conn.cursor()

        # Keep the initial status as Not Started
        c.execute('insert into items(item, status) values(?,?)', (item, NOTSTARTED))

        # We commit to save the change
        conn.commit()
        return {"item": item, "status": NOTSTARTED}
    except Exception as e:
        print('Error: ', e)
        return None

def get_all_items():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('select * from items')
        rows = c.fetchall()

        """
        rowarray_list = []

        for row in rows:
            t = (row[0], row[1], row[2])
            rowarray_list.append(t)

        respuesta = {"items" : rowarray_list}
        j = json.dumps(respuesta)
        """

        objects_list = []
        
        for row in rows:
            d = collections.OrderedDict()
            d['id'] = row[0]
            d['item'] = row[1]
            d['status'] = row[2]
            objects_list.append(d)

        respuesta = {"items" : objects_list}
        #j = json.dumps(respuesta)

        return respuesta
    except Exception as e:
        print('Error: ', e)
        return None

def get_item(itemid):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("select id, item, status from items where id=%s" % itemid)
        rows = c.fetchall()
        rowCount = len(rows)
        conn.commit()

        if rowCount == 0:
            return None
            
        objects_list = []
        for row in rows:
            d = collections.OrderedDict()
            d['id'] = row[0]
            d['item'] = row[1]
            d['status'] = row[2]
            objects_list.append(d)
        return objects_list
    except Exception as e:
        print('Error: ', e)
        return None

def update_status(itemid, status):
    # Check if the passed status is a valid value
    if (status.lower().strip() == 'not started'):
        status = NOTSTARTED
    elif (status.lower().strip() == 'in progress'):
        status = INPROGRESS
    elif (status.lower().strip() == 'completed'):
        status = COMPLETED
    else:
        print("Invalid Status: " + status)
        respuesta = {"error" : "El status '" + status + "' no existe. Las opciones son: '" + NOTSTARTED + "', '" + INPROGRESS + "' y '" + COMPLETED + "'." }
        return respuesta

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('update items set status=? where id=?', (status, itemid))
        rowCount = c.rowcount
        conn.commit()
        if rowCount == 0:  
            return {"error" : "El item " + str(itemid) + " no existe."}
        else:
            return {itemid: status}
    except Exception as e:
        print('Error: ', e)
        return None

def delete_item(itemid):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('delete from items where id=?', (itemid,))
        rowCount = c.rowcount
        conn.commit()
        if rowCount == 0:
            return {"error" : "El item " + itemid + " no existe."}
        else:
            return {"Item eliminado": itemid}
    except Exception as e:
        print('Error: ', e)
        return None