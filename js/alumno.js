const form = document.getElementById('formAsistencia');
const mensaje = document.getElementById('mensaje');

// ========== NUEVAS FUNCIONES PARA CONTROL DE DUPLICADOS ==========

// Obtener IP del usuario
async function obtenerIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error al obtener IP:', error);
    return null;
  }
}

// Verificar si puede registrarse hoy (nombre + grupo + IP)
async function puedeRegistrarseHoy(nombre, grupo, ip) {
  const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Verificar por nombre y grupo
  const { data: porNombre } = await supabase
    .from('alumnos')
    .select('*')
    .ilike('nombre', nombre)
    .ilike('grupo', grupo)
    .gte('ultima_asistencia', hoy);
  
  if (porNombre && porNombre.length > 0) {
    return { 
      puede: false, 
      razon: 'Ya te registraste hoy con este nombre y grupo' 
    };
  }
  
  // Verificar por IP (si está disponible)
  if (ip) {
    const { data: porIP } = await supabase
      .from('registros_diarios')
      .select('*')
      .eq('ip', ip)
      .eq('fecha', hoy);
    
    if (porIP && porIP.length > 0) {
      return { 
        puede: false, 
        razon: 'Este alumno ya registró una asistencia hoy' 
      };
    }
  }
  
  return { puede: true };
}

// Registrar IP del día
async function registrarIPDelDia(ip, nombre, grupo) {
  if (!ip) return;
  
  const hoy = new Date().toISOString().split('T')[0];
  
  await supabase
    .from('registros_diarios')
    .insert([{ 
      ip: ip,
      fecha: hoy,
      nombre: nombre,
      grupo: grupo
    }]);
}

// ========== FUNCIONES ORIGINALES ==========

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

function distanciaLevenshtein(a, b) {
  const matriz = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  
  for (let i = 0; i <= a.length; i++) matriz[0][i] = i;
  for (let j = 0; j <= b.length; j++) matriz[j][0] = j;
  
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[j][i] = Math.min(
        matriz[j][i - 1] + 1,
        matriz[j - 1][i] + 1,
        matriz[j - 1][i - 1] + costo
      );
    }
  }
  
  return matriz[b.length][a.length];
}

function similitudPorPalabras(nombre1, nombre2) {
  const palabras1 = nombre1.split(/\s+/);
  const palabras2 = nombre2.split(/\s+/);
  let coincidencias = 0;
  
  for (let p1 of palabras1) {
    for (let p2 of palabras2) {
      const dist = distanciaLevenshtein(p1, p2);
      const umbral = Math.max(1, Math.floor(Math.max(p1.length, p2.length) * 0.25));
      if (dist <= umbral) coincidencias++;
    }
  }
  
  return coincidencias / Math.max(palabras1.length, palabras2.length);
}

function similitudTextoCompleto(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const dist = distanciaLevenshtein(str1, str2);
  return 1 - (dist / maxLen);
}

function gruposSimilares(grupo1, grupo2) {
  const match1 = grupo1.match(/(\d+)([a-z]*)/);
  const match2 = grupo2.match(/(\d+)([a-z]*)/);
  
  if (!match1 || !match2) return false;
  
  const [, num1, letra1] = match1;
  const [, num2, letra2] = match2;
  
  const numDiff = Math.abs(parseInt(num1) - parseInt(num2));
  
  return letra1 === letra2 && numDiff <= 1;
}

async function buscarAlumnoSimilar(nombre, grupo) {
  let { data: registrosExactos } = await supabase
    .from('alumnos')
    .select('*')
    .eq('grupo', grupo);
  
  let candidato = buscarMejorCoincidencia(nombre, registrosExactos);
  if (candidato && candidato.similitud >= 0.7) {
    return candidato;
  }
  
  const { data: todosRegistros } = await supabase
    .from('alumnos')
    .select('*');
  
  const registrosSimilares = todosRegistros.filter(r => 
    gruposSimilares(normalizarTexto(r.grupo), grupo)
  );
  
  candidato = buscarMejorCoincidencia(nombre, registrosSimilares);
  if (candidato && candidato.similitud >= 0.75) {
    return candidato;
  }
  
  candidato = buscarMejorCoincidencia(nombre, todosRegistros);
  if (candidato && candidato.similitud >= 0.85) {
    return candidato;
  }
  
  return null;
}

function buscarMejorCoincidencia(nombre, registros) {
  let mejorCandidato = null;
  let mayorSimilitud = 0;
  
  for (let registro of registros) {
    const nombreRegistro = normalizarTexto(registro.nombre);
    
    const simPalabras = similitudPorPalabras(nombre, nombreRegistro);
    const simTexto = similitudTextoCompleto(nombre, nombreRegistro);
    
    const similitudFinal = (simPalabras * 0.6) + (simTexto * 0.4);
    
    if (similitudFinal > mayorSimilitud) {
      mayorSimilitud = similitudFinal;
      mejorCandidato = {
        registro,
        similitud: similitudFinal,
        nombreOriginal: registro.nombre,
        grupoOriginal: registro.grupo
      };
    }
  }
  
  return mejorCandidato;
}

// ========== EVENTO SUBMIT MODIFICADO ==========

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const nombreOriginal = document.getElementById('nombre').value;
  const grupoOriginal = document.getElementById('grupo').value;
  const nombre = normalizarTexto(nombreOriginal);
  const grupo = normalizarTexto(grupoOriginal);
  
  // 🔒 OBTENER IP Y VERIFICAR SI PUEDE REGISTRARSE
  const ip = await obtenerIP();
  const verificacion = await puedeRegistrarseHoy(nombreOriginal, grupoOriginal, ip);
  
  if (!verificacion.puede) {
    mensaje.textContent = `❌ ${verificacion.razon}`;
    mensaje.style.background = '#f8d7da';
    mensaje.style.color = '#721c24';
    mensaje.style.padding = '15px';
    mensaje.style.borderRadius = '5px';
    mensaje.style.display = 'block';
    
    setTimeout(() => {
      mensaje.textContent = '';
      mensaje.style.background = '';
      mensaje.style.color = '';
      mensaje.style.display = '';
    }, 5000);
    
    return; // Detener el registro
  }
  
  // Buscar alumno similar
  const candidato = await buscarAlumnoSimilar(nombre, grupo);
  const hoy = new Date().toISOString().split('T')[0];
  
  if (candidato) {
    const registro = candidato.registro;
    const nuevasAsistencias = registro.asistencias + 1;
    const nuevasHoras = nuevasAsistencias * 10;
    
    // Actualizar asistencias y última asistencia
    await supabase
      .from('alumnos')
      .update({ 
        asistencias: nuevasAsistencias, 
        horas: nuevasHoras,
        ultima_asistencia: hoy
      })
      .eq('id', registro.id);
    
    // Registrar IP del día
    await registrarIPDelDia(ip, nombreOriginal, grupoOriginal);
    
    if (candidato.nombreOriginal !== nombre || candidato.grupoOriginal !== grupo) {
      mensaje.textContent = `✅ Asistencia registrada para ${candidato.nombreOriginal} (${candidato.grupoOriginal}) - ${nuevasHoras} horas acumuladas.`;
      mensaje.style.background = '#fff3cd';
      mensaje.style.padding = '15px';
      mensaje.style.borderRadius = '5px';
      mensaje.style.display = 'block';
    } else {
      mensaje.textContent = `✅ Asistencia registrada (${nuevasHoras} horas acumuladas).`;
      mensaje.style.background = '#d4edda';
      mensaje.style.padding = '15px';
      mensaje.style.borderRadius = '5px';
      mensaje.style.display = 'block';
    }
  } else {
    // Nuevo alumno
    await supabase
      .from('alumnos')
      .insert([{ 
        nombre: nombreOriginal,
        grupo: grupoOriginal,
        asistencias: 1,
        horas: 5,
        ultima_asistencia: hoy
      }]);
    
    // Registrar IP del día
    await registrarIPDelDia(ip, nombreOriginal, grupoOriginal);
    
    mensaje.textContent = "✅ Nuevo alumno registrado con 5 horas.";
    mensaje.style.background = '#d1ecf1';
  }
  
  form.reset();
  
  setTimeout(() => {
    mensaje.textContent = '';
    mensaje.style.background = '';
  }, 5000);
});
