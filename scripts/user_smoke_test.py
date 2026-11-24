"""User search and access lifecycle checks; creates demo data in the selected environment."""
import argparse
import json
import uuid
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', required=True)
args = parser.parse_args()
base = args.url.rstrip('/')
passed = []


def call(method, path, data=None, token=None, expected=200):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers, method=method)
    try:
        with urlopen(request, timeout=30) as response:
            status, raw = response.status, response.read()
    except HTTPError as error:
        status, raw = error.code, error.read()
    assert status == expected, f'{method} {path}: expected {expected}, received {status}'
    return json.loads(raw) if raw else None


def check(name, condition=True):
    assert condition, name
    passed.append(name)
    print('PASS ' + name, flush=True)


admin = call('POST', '/api/usuarios/login', {'email': 'admin@fintech.pe', 'password': 'admin123'})['token']
suffix = uuid.uuid4().hex[:10]
email = f'users-{suffix}@example.test'
nombre, apellido = 'Persona' + suffix, 'ApellidoVerificado'
user = call('POST', '/api/usuarios/registro', {'email': email, 'password': 'Prueba123!', 'nombre': nombre, 'apellido': apellido}, expected=201)
uid, token = user['usuarioId'], user['token']
check('Self registration creates a customer', user['rol'] == 'CLIENTE')


def search(text, **filters):
    return call('GET', '/api/usuarios?' + urlencode({'busqueda': text, **filters}), token=admin)


call('GET', '/api/usuarios?' + urlencode({'busqueda': nombre}), token=token, expected=403)
check('Customer cannot access the administrative user search')
check('Full name is searchable', any(row['id'] == uid for row in search(nombre + ' ' + apellido)['content']))
check('Full-name search ignores case and surrounding spaces', search('  ' + (nombre + ' ' + apellido).upper() + '  ')['totalElements'] == 1)
check('Email is searchable', search(email)['totalElements'] == 1)
check('Search preserves role filters', search(email, rol='ADMIN')['totalElements'] == 0)
check('Search preserves active-state filters', search(email, estado='false')['totalElements'] == 0)
call('PATCH', f'/api/usuarios/{uid}/estado?activo=false', token=admin)
call('GET', f'/api/cuentas/usuario/{uid}', token=token, expected=401)
check('Deactivation revokes the previous session across services')
call('POST', '/api/usuarios/login', {'email': email, 'password': 'Prueba123!'}, expected=401)
check('Inactive customers cannot sign in')
check('Inactive customers remain searchable with history preserved', search(email, estado='false')['totalElements'] == 1)
call('PATCH', f'/api/usuarios/{uid}/estado?activo=true', token=admin)
fresh = call('POST', '/api/usuarios/login', {'email': email, 'password': 'Prueba123!'})
check('Reactivation permits a new session', fresh['autenticado'])
call('GET', f'/api/cuentas/usuario/{uid}', token=token, expected=401)
check('Reactivation does not resurrect revoked sessions')
print(json.dumps({'passed': len(passed), 'checks': passed}, indent=2))
