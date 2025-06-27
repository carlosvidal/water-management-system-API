# AquaFlow API - Ejemplos de Uso

## 🚀 Ejemplos en Diferentes Lenguajes

### JavaScript/Node.js (Axios)

```javascript
const axios = require('axios');

// Configuración base
const API_BASE = 'http://localhost:3000/api';

class AquaFlowClient {
  constructor() {
    this.token = null;
    this.axios = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para agregar token automáticamente
    this.axios.interceptors.request.use(config => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  // Autenticación
  async login(email, password) {
    try {
      const response = await this.axios.post('/auth/login', {
        email,
        password
      });
      
      this.token = response.data.accessToken;
      return response.data;
    } catch (error) {
      throw new Error(`Login failed: ${error.response.data.message}`);
    }
  }

  // Obtener condominios
  async getCondominiums() {
    const response = await this.axios.get('/admin/condominiums');
    return response.data.condominiums;
  }

  // Crear lectura
  async createReading(periodId, unitId, meterId, value, notes = '') {
    const response = await this.axios.post(`/periods/${periodId}/readings`, {
      unitId,
      meterId,
      value,
      notes
    });
    return response.data;
  }

  // Calcular facturación
  async calculateBills(periodId, condominiumId) {
    const response = await this.axios.post('/bills/calculate', {
      periodId,
      condominiumId
    });
    return response.data;
  }
}

// Uso
async function example() {
  const client = new AquaFlowClient();
  
  // Login
  await client.login('admin@aquaflow.com', 'SuperAdmin123!');
  
  // Obtener condominios
  const condominiums = await client.getCondominiums();
  console.log('Condominiums:', condominiums);
  
  // Crear lectura
  const reading = await client.createReading(
    'period-id',
    'unit-id', 
    'meter-id',
    1234.5,
    'Lectura normal'
  );
  console.log('Reading created:', reading);
}
```

### Python (Requests)

```python
import requests
import json

class AquaFlowClient:
    def __init__(self, base_url='http://localhost:3000/api'):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def _update_auth_header(self):
        if self.token:
            self.session.headers.update({
                'Authorization': f'Bearer {self.token}'
            })
    
    def login(self, email, password):
        """Autenticar usuario"""
        response = self.session.post(
            f'{self.base_url}/auth/login',
            json={'email': email, 'password': password}
        )
        response.raise_for_status()
        
        data = response.json()
        self.token = data['accessToken']
        self._update_auth_header()
        return data
    
    def get_condominiums(self):
        """Obtener lista de condominios"""
        response = self.session.get(f'{self.base_url}/admin/condominiums')
        response.raise_for_status()
        return response.json()['condominiums']
    
    def create_reading(self, period_id, unit_id, meter_id, value, notes=''):
        """Crear nueva lectura"""
        response = self.session.post(
            f'{self.base_url}/periods/{period_id}/readings',
            json={
                'unitId': unit_id,
                'meterId': meter_id,
                'value': value,
                'notes': notes
            }
        )
        response.raise_for_status()
        return response.json()
    
    def calculate_bills(self, period_id, condominium_id):
        """Calcular facturas del período"""
        response = self.session.post(
            f'{self.base_url}/bills/calculate',
            json={
                'periodId': period_id,
                'condominiumId': condominium_id
            }
        )
        response.raise_for_status()
        return response.json()

# Uso
def main():
    client = AquaFlowClient()
    
    # Login
    login_data = client.login('admin@aquaflow.com', 'SuperAdmin123!')
    print(f"Logged in as: {login_data['user']['name']}")
    
    # Obtener condominios
    condominiums = client.get_condominiums()
    print(f"Found {len(condominiums)} condominiums")
    
    # Crear lectura
    reading = client.create_reading(
        period_id='period-id',
        unit_id='unit-id',
        meter_id='meter-id',
        value=1234.5,
        notes='Lectura normal'
    )
    print(f"Reading created: {reading['id']}")

if __name__ == '__main__':
    main()
```

### cURL

```bash
#!/bin/bash

# Variables
API_BASE="http://localhost:3000/api"
EMAIL="admin@aquaflow.com"
PASSWORD="SuperAdmin123!"

# Login y obtener token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
echo "✅ Token obtained: ${TOKEN:0:20}..."

# Obtener perfil de usuario
echo -e "\n👤 Getting user profile..."
curl -s -X GET "$API_BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Obtener condominios
echo -e "\n🏢 Getting condominiums..."
CONDOMINIUMS=$(curl -s -X GET "$API_BASE/admin/condominiums" \
  -H "Authorization: Bearer $TOKEN")
echo $CONDOMINIUMS | jq '.condominiums[0]'

# Extraer ID del primer condominio
CONDOMINIUM_ID=$(echo $CONDOMINIUMS | jq -r '.condominiums[0].id')
echo "Using condominium ID: $CONDOMINIUM_ID"

# Obtener detalles del condominio
echo -e "\n🏠 Getting condominium details..."
curl -s -X GET "$API_BASE/condominiums/$CONDOMINIUM_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Obtener períodos del condominio
echo -e "\n📅 Getting periods..."
PERIODS=$(curl -s -X GET "$API_BASE/periods/condominium/$CONDOMINIUM_ID" \
  -H "Authorization: Bearer $TOKEN")
echo $PERIODS | jq '.periods[0]'

# Crear un nuevo período
echo -e "\n➕ Creating new period..."
NEW_PERIOD=$(curl -s -X POST "$API_BASE/periods" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\":\"Test Period $(date +%Y-%m)\",
    \"condominiumId\":\"$CONDOMINIUM_ID\",
    \"startDate\":\"$(date +%Y-%m-01)\",
    \"endDate\":\"$(date +%Y-%m-31)\"
  }")
echo $NEW_PERIOD | jq .

echo -e "\n✅ API test completed successfully!"
```

### Flutter/Dart (Dio)

```dart
import 'package:dio/dio.dart';

class AquaFlowClient {
  late Dio _dio;
  String? _token;
  
  AquaFlowClient({String baseUrl = 'http://localhost:3000/api'}) {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      headers: {'Content-Type': 'application/json'},
    ));
    
    // Interceptor para agregar token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        if (_token != null) {
          options.headers['Authorization'] = 'Bearer $_token';
        }
        handler.next(options);
      },
    ));
  }
  
  // Autenticación
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });
      
      _token = response.data['accessToken'];
      return response.data;
    } catch (e) {
      throw Exception('Login failed: $e');
    }
  }
  
  // Obtener condominios
  Future<List<dynamic>> getCondominiums() async {
    final response = await _dio.get('/admin/condominiums');
    return response.data['condominiums'];
  }
  
  // Crear lectura
  Future<Map<String, dynamic>> createReading({
    required String periodId,
    required String unitId,
    required String meterId,
    required double value,
    String notes = '',
  }) async {
    final response = await _dio.post('/periods/$periodId/readings', data: {
      'unitId': unitId,
      'meterId': meterId,
      'value': value,
      'notes': notes,
    });
    return response.data;
  }
  
  // Calcular facturas
  Future<Map<String, dynamic>> calculateBills({
    required String periodId,
    required String condominiumId,
  }) async {
    final response = await _dio.post('/bills/calculate', data: {
      'periodId': periodId,
      'condominiumId': condominiumId,
    });
    return response.data;
  }
}

// Uso
void main() async {
  final client = AquaFlowClient();
  
  // Login
  final loginData = await client.login(
    'admin@aquaflow.com', 
    'SuperAdmin123!'
  );
  print('Logged in as: ${loginData['user']['name']}');
  
  // Obtener condominios
  final condominiums = await client.getCondominiums();
  print('Found ${condominiums.length} condominiums');
  
  // Crear lectura
  final reading = await client.createReading(
    periodId: 'period-id',
    unitId: 'unit-id',
    meterId: 'meter-id',
    value: 1234.5,
    notes: 'Lectura normal',
  );
  print('Reading created: ${reading['id']}');
}
```

## 🔄 Flujos Completos

### Flujo 1: Registro de Lecturas

```javascript
async function completeReadingFlow() {
  const client = new AquaFlowClient();
  
  // 1. Autenticación
  await client.login('demo@sunsetgardens.com', 'DemoAdmin123!');
  
  // 2. Obtener condominios del usuario
  const condominiums = await client.getCondominiums();
  const condominium = condominiums[0];
  
  // 3. Obtener período activo
  const periods = await client.axios.get(`/periods/condominium/${condominium.id}`);
  const activePeriod = periods.data.periods.find(p => p.status === 'ACTIVE');
  
  // 4. Obtener unidades pendientes
  const pendingUnits = await client.axios.get(`/periods/${activePeriod.id}/pending`);
  
  // 5. Registrar lecturas
  for (const unit of pendingUnits.data.slice(0, 5)) { // Solo primeras 5
    const reading = await client.createReading(
      activePeriod.id,
      unit.id,
      unit.meters[0].id,
      Math.random() * 1000 + 1000, // Valor aleatorio
      'Lectura automática'
    );
    console.log(`Reading created for unit ${unit.name}: ${reading.value}`);
  }
  
  // 6. Calcular facturas
  const bills = await client.calculateBills(activePeriod.id, condominium.id);
  console.log(`Bills calculated: ${bills.summary.totalBills} bills generated`);
}
```

### Flujo 2: Gestión de Condominio

```javascript
async function condominiumManagementFlow() {
  const client = new AquaFlowClient();
  
  // 1. Login como Super Admin
  await client.login('admin@aquaflow.com', 'SuperAdmin123!');
  
  // 2. Crear nuevo condominio
  const newCondominium = await client.axios.post('/admin/condominiums', {
    name: 'Nuevo Condominio Demo',
    address: '456 Demo Street',
    city: 'Demo City',
    country: 'Demo Country',
    readingDay: 15,
    planId: 'basic-plan-id'
  });
  
  const condominiumId = newCondominium.data.id;
  
  // 3. Crear bloques
  const blockA = await client.axios.post(`/condominiums/${condominiumId}/blocks`, {
    name: 'Bloque A',
    maxUnits: 10
  });
  
  // 4. Crear unidades
  for (let i = 1; i <= 5; i++) {
    await client.axios.post(`/condominiums/${condominiumId}/units`, {
      name: `A${100 + i}`,
      blockId: blockA.data.id
    });
  }
  
  // 5. Crear residentes
  const resident = await client.axios.post(`/condominiums/${condominiumId}/residents`, {
    name: 'Residente Demo',
    email: 'residente@demo.com',
    phone: '+1-555-0123'
  });
  
  // 6. Asignar residente a unidad
  const units = await client.axios.get(`/condominiums/${condominiumId}/units`);
  await client.axios.put(`/condominiums/${condominiumId}/units/${units.data.units[0].id}/resident`, {
    residentId: resident.data.id
  });
  
  console.log('Condominium setup completed successfully!');
}
```

## 🔗 Enlaces Útiles

- **Swagger UI**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health
- **Postman Collection**: `docs/AquaFlow-API.postman_collection.json`
- **OpenAPI Spec**: `docs/openapi.json`

## 📞 Soporte

Si necesitas ayuda con la integración del API:
- 📧 Email: support@aquaflow.com
- 📚 Documentación: http://localhost:3000/api-docs
- 🐛 Issues: GitHub Repository

---

**Nota**: Recuerda reemplazar los IDs de ejemplo con IDs reales de tu base de datos.