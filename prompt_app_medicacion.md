# ESPECIFICACIONES DE APP DE GESTIÓN Y RECORDATORIO DE MEDICACIÓN

## VISIÓN GENERAL DEL PROYECTO
Desarrollar una aplicación móvil (prioritariamente iOS y Android) que ayude a los usuarios a gestionar el cumplimiento de sus tratamientos medicamentosos mediante recordatorios inteligentes, seguimiento de dosis y control de adherencia. La app debe ser intuitiva, accesible y confiable, especialmente para usuarios mayores o con poca experiencia tecnológica.

## REQUISITOS FUNCIONALES PRINCIPALES

### 1. GESTIÓN DE MEDICAMENTOS

#### 1.1 Registro de Medicinas
- El usuario podrá agregar medicamentos a su perfil introduciendo el nombre de cada medicina
- Para cada medicamento se registrará como mínimo: nombre del medicamento, dosis (cantidad), unidad de medida
- Funcionalidad opcional de captura de foto del medicamento para identificación visual
- Posibilidad de capturar prescripciones médicas mediante escaneo (OCR)
- Campo para notas o instrucciones especiales asociadas al medicamento

#### 1.2 Gestión de Tomas
El usuario deberá configurar un plan de tomas para cada medicamento con los siguientes parámetros:

**Frecuencia de toma:**
- Diariamente
- Días específicos de la semana (selección múltiple)
- Días específicos del mes (selector de calendario)
- Patrón personalizado

**Horarios de toma:**
- El usuario podrá establecer múltiples horarios en el mismo día para un mismo medicamento
- Selector de hora y minuto de fácil uso
- Dividir el día en bloques (Mañana, Tarde, Noche) como facilitador visual
- Mínimo 1 toma, máximo ilimitado por medicamento

**Ejemplo de configuración:**
- Medicamento A: Todos los días a las 08:00 y 20:00 (2 tomas)
- Medicamento B: Lunes, Miércoles, Viernes a las 14:00 (1 toma)
- Medicamento C: Días alternos a las 12:00 (1 toma)

---

### 2. SISTEMA DE NOTIFICACIONES Y AVISOS

#### 2.1 Características Técnicas de Notificaciones
- Las notificaciones deben funcionar incluso cuando la app está cerrada
- Las notificaciones deben ser locales (funcionar sin conexión a internet)
- Las notificaciones deben adaptarse a la zona horaria del dispositivo
- Deben activarse aunque la pantalla esté bloqueada

#### 2.2 Presentación Visual de Notificación
- **Tipo:** Notificación a pantalla completa (full-screen intent)
- **Apariencia:** Ocupar la totalidad de la pantalla del dispositivo
- **Sonido personalizado:** Usar un sonido distintivo que diferencie la alerta de medicación de otras notificaciones
- **Vibración:** Incluir patrón de vibración configurable (activar/desactivar)
- **Fondo personalizable:** El usuario podrá seleccionar o subir una imagen de fondo para la notificación
- **Información mostrada:** 
  - Nombre del medicamento
  - Dosis a tomar
  - Instrucciones especiales (si las hay)
  - Imagen del medicamento (si está disponible)
  - Hora de la toma programada

#### 2.3 Opciones de Acción en la Notificación
Tres botones de acción principales:

**CONFIRMADO**
- Indica que el usuario se ha tomado la medicación
- Registra la toma en el historial con timestamp automático
- Cierra la notificación
- Opcionalmente, puede mostrar un mensaje de confirmación/refuerzo positivo

**POSPONER**
- Retrasa la notificación un período configurable (por defecto 30 minutos)
- El usuario puede posponer múltiples veces
- Control: máximo de postergaciones permitidas antes de forzar confirmación/omisión
- La notificación reaparece como full-screen intent nuevamente

**OMITIR**
- El usuario declara que no desea tomar la medicación en este momento
- Se registra como "omitida" en el historial
- La app puede mostrar un campo de texto opcional para que el usuario indique el motivo
- Cierra la notificación sin registrar la toma como confirmada

---

### 3. HISTORIAL Y SEGUIMIENTO DE ADHERENCIA

#### 3.1 Panel de Cumplimiento
- El usuario podrá ver un resumen del cumplimiento actual (últimos 7 días, últimos 30 días)
- Vista por medicamento individual
- Indicadores visuales de adherencia (porcentaje completado, calendarios de calor/color)

#### 3.2 Consulta de Historial de Tomas
- Seleccionar un medicamento específico
- Seleccionar rango de fechas (últimos 7 días, últimos 30 días, rango personalizado)
- Para cada toma programada, mostrar:
  - Fecha y hora programada
  - Estado: Confirmada / Pospuesta / Omitida / Pendiente
  - Hora real de confirmación (si aplica)
  - Notas del usuario (si aplica)

#### 3.3 Estadísticas de Adherencia
- Porcentaje de cumplimiento por medicamento
- Gráficos de tendencia (cumplimiento en el tiempo)
- Identificar patrones de incumplimiento (ej: siempre omite cierta hora)
- Alertas visuales si la adherencia cae por debajo de un umbral configurado

---

### 4. REGISTRO DE SIGNOS VITALES

#### 4.1 Entrada Manual de Datos
El usuario podrá registrar manualmente dos tipos de mediciones:

**Presión Arterial (Tensión)**
- Seleccionar tipo de lectura: Presión sistólica y diastólica
- Registrar valores en mmHg
- Permitir notas adicionales

**Pulsaciones (Frecuencia Cardíaca)**
- Registrar valor en ppm (pulsaciones por minuto)
- Permitir notas adicionales

#### 4.2 Características de la Entrada
- Interfaz simple y clara para entrada de datos
- Timestamp automático de cuándo se registró el dato
- Opción de seleccionar la hora de la medición
- Validación de rangos razonables (alertas si valores son anormales)

#### 4.3 Historial de Signos Vitales
- Vista de historial de todas las mediciones registradas
- Gráficos de tendencia para presión arterial y pulsaciones
- Filtrar por rango de fechas
- Exportación de datos (opcional)

---

### 5. SISTEMA DE AVISOS PARA SIGNOS VITALES

#### 5.1 Configuración de Recordatorios
El usuario podrá establecer recordatorios periódicos para medir:
- Presión arterial (frecuencia configurable: diaria, semanal, mensual, personalizada)
- Pulsaciones (frecuencia configurable)

#### 5.2 Notificaciones de Signos Vitales
- Recordatorios con opción para ir directamente a la pantalla de entrada de datos
- Tipo similar a las notificaciones de medicación, pero diferenciable visualmente
- Opciones: Realizado Ahora / Posponer / Omitir

---

## REQUISITOS NO FUNCIONALES

### Interfaz y UX/UI

#### Diseño General
- Interfaz clara, minimalista y fácil de usar
- Especial consideración para usuarios mayores (textos grandes, contraste alto)
- Paleta de colores médica: azules, verdes, con acentos reconocibles
- Tipografía legible con tamaños ajustables

#### Accesibilidad
- Cumplimiento de estándares WCAG 2.1 (nivel AA mínimo)
- Soporte para lectores de pantalla
- Contraste suficiente entre texto y fondo
- Tamaño mínimo de botones para fácil pulsación (thumb-friendly)
- Opción de modo oscuro

#### Flujo de Onboarding
- Tutorial introductorio no invasivo (puede ser saltable)
- Pasos guiados para primera configuración de medicamentos
- Explicación clara de funcionalidades principales
- Opción de entrada sin autenticación o con OTP simple

#### Personalización
- Fondo personalizable para notificaciones
- Configuración de sonidos y vibraciones
- Temas de color opcionales
- Tamaño de fuente ajustable

### Datos y Base de Datos

#### Almacenamiento
- Base de datos local con soporte para sincronización en la nube (opcional)
- Uso de SQLite (offline) o Realm para dispositivos móviles
- Sincronización segura en la nube (Firebase, AWS)

#### Integridad de Datos
- Validación de datos de entrada
- Backup automático de configuración y historial
- Recuperación de datos en caso de desinstalación

### Seguridad y Privacidad

#### Datos de Salud
- Cumplimiento normativo: HIPAA (USA), GDPR (UE), LGPD (Brasil)
- Encriptación end-to-end de datos sensibles
- Autenticación de usuario (biometría o contraseña)
- Opción de acceso con PIN

#### Permisos
- Solicitar solo permisos necesarios
- Explicar claramente por qué se necesita cada permiso
- Mínimos permisos requeridos:
  - Notificaciones
  - Calendario (opcional)
  - Cámara (si OCR de prescripciones)
  - Almacenamiento local

### Compatibilidad

#### Plataformas
- iOS: Versiones 13.0 en adelante
- Android: API 28 (Android 9.0) en adelante

#### Dispositivos
- Soporte para teléfonos de diferentes tamaños
- Soporte para tablet (versión optimizada recomendada)
- Prueba en dispositivos con especificaciones bajas

### Performance
- Tiempos de carga < 2 segundos para pantallas principales
- Notificaciones que se disparen dentro de ±2 minutos de la hora programada
- Bajo consumo de batería
- Almacenamiento mínimo requerido < 50MB

---

## CARACTERÍSTICAS OPCIONALES / FUTURAS

- Integración con wearables (smartwatch)
- Compartir datos con profesionales médicos (cuidador, doctor)
- Integración con historial médico electrónico
- Recordatorio de reabastecimiento de medicinas
- Conteo de inventario de píldoras
- Compatibilidad con calendarios de terceros
- Integración con aplicaciones de telemedicina
- Predicción de adherencia con IA
- Reporte automático a profesionales de salud
- Múltiples perfiles de usuario (cuidadores de otros)

---

## METODOLOGÍA DE DESARROLLO SUGERIDA

1. **Fase 1: Planificación y Diseño**
   - Creación de wireframes y prototipos
   - Validación con usuarios potenciales
   - Definición de arquitectura técnica

2. **Fase 2: Desarrollo MVP**
   - Funcionalidades core (medicamentos, recordatorios, historial)
   - iOS y Android en paralelo
   - Testing continuo

3. **Fase 3: Signos Vitales y Refinamiento**
   - Integración de módulo de signos vitales
   - Optimización de performance
   - Pruebas de seguridad

4. **Fase 4: Lanzamiento y Post-Lanzamiento**
   - QA final
   - App Store y Google Play
   - Soporte y actualizaciones

---

## RECURSOS TÉCNICOS RECOMENDADOS

### Frontend (Cliente Móvil)
- **iOS:** Swift + SwiftUI o UIKit
- **Android:** Kotlin + Jetpack Compose o XML layouts
- **Cross-Platform (alternativa):** React Native o Flutter

### Backend (si se requiere sincronización en la nube)
- Node.js, Python (Django), o .NET Core
- RESTful API o GraphQL

### Base de Datos
- SQLite o Realm (local)
- PostgreSQL o MongoDB (servidor)

### Cloud / Hosting
- AWS Lambda + S3
- Firebase (Firestore, Cloud Functions)
- Google Cloud

### Notificaciones
- Firebase Cloud Messaging (Android)
- APNs - Apple Push Notification service (iOS)
- Notificaciones locales (sin servidor)

### Herramientas DevOps
- Control de versiones: Git
- CI/CD: GitHub Actions, Jenkins
- Testing: XCTest (iOS), JUnit (Android)

---

## ÉXITO Y MÉTRICAS

La app será exitosa cuando logre:
- Tasa de retención > 80% a los 30 días
- Adherencia medicamentosa mejorada en usuarios (target: >80%)
- Puntuación de satisfacción en stores > 4.5/5
- Tiempo de adopción < 5 minutos para nuevos usuarios
- Cero fallos críticos en notificaciones durante el primer mes
