import helper
from flask import Flask, request, Response, json, render_template
from flask_cors import CORS
import json
import markdown

app = Flask(__name__)
cors = CORS(app, resources={r"*": {"origins": "*"}})

@app.route('/')
def hello_world():
    #return 'Hello World!'
    return render_template('index.html')

@app.route('/item/new', methods=['POST'])
def add_item():
    # Get item from the POST body
    req_data = request.get_json()
    item = req_data['item']

    # Add item to the list
    res_data = helper.add_to_list(item)

    # Return error if item not added
    if res_data is None:
        response = Response("{'error': 'Item not added - " + item + "'}", status=400 , mimetype='application/json')
        return response

    # Return response
    response = Response(json.dumps(res_data), mimetype='application/json')

    return response

@app.route('/items/all')
def get_all_items():
    # Get items from the helper
    res_data = helper.get_all_items()

    # Return response
    response = Response(json.dumps(res_data), mimetype='application/json')
    return response

@app.route('/item/status', methods=['GET'])
def get_item():
    # Get parameter from the URL
    itemid = request.args.get('itemid')

    # Get items from the helper
    status = helper.get_item(itemid)

    # Return 404 if item not found
    if status is None:
        respuesta = {"error":"No se encontró el item " + str(itemid) + "."}
        response = Response(json.dumps(respuesta), status=404 , mimetype='application/json')
        return response

    # Return status
    """res_data = {
        'status': status
    }"""

    response = Response(json.dumps(status), status=200, mimetype='application/json')
    return response

@app.route('/item/update', methods=['PUT'])
def update_status():
    # Get item from the POST body
    req_data = request.get_json()
    itemid = req_data['itemid']
    status = req_data['status']

    # Update item in the list
    res_data = helper.update_status(itemid, status)

    # Return error if the status could not be updated
    if res_data is None:
        respuesta = {"error" : "Se produjo un error al actualizar el status."}
        response = Response(json.dumps(respuesta), status=400 , mimetype='application/json')
        return response

    # Return response
    response = Response(json.dumps(res_data), mimetype='application/json')

    return response

@app.route('/item/remove', methods=['DELETE'])
def delete_item():
    # Get item from the POST body
    req_data = request.get_json()
    itemid = req_data['itemid']

    # Delete item from the list
    res_data = helper.delete_item(itemid)

    # Return error if the item could not be deleted
    if res_data is None:
        respuesta = {"error" : "No se encontró el item " + str(itemid) + "."}
        response = Response(json.dumps(respuesta), status=400 , mimetype='application/json')
        return response

    # Return response
    response = Response(json.dumps(res_data), mimetype='application/json')

    return response