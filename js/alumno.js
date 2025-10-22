const form = document.getElementById('formAsistencia');
const mensaje = document.getElementById('mensaje');

// Función para normalizar texto
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}

// Distancia de Levenshtein (mide diferencias entre strings)
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

// Similitud por palabras individuales
function similitudPorPalabras(nombre1, nombre2) {
  const palabras1 = nombre1.split(/\s+/);
  const palabras2 = nombre2.split(/\s+/);
  let coincidencias = 0;
  
  for (let p1 of palabras1) {
    for (let p2 of palabras2) {
      // Palabras idénticas o muy similares
      const dist = distanciaLevenshtein(p1, p2);
      const umbral = Math.max(1, Math.floor(Math.max(p1.length, p2.length) * 0.25));
      if (dist <= umbral) coincidencias++;
    }
  }
  
  return coincidencias / Math.max(palabras1.length, palabras2.length);
}

// Similitud de string completo
function similitudTextoCompleto(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const dist = distanciaLevenshtein(str1, str2);
  return 1 - (dist / maxLen);
}

// Normalizar y verificar grupos similares
function gruposSimilares(grupo1, grupo2) {
  // Extraer número y letra del grupo (ej: "5i" -> numero: 5, letra: "i")
  const match1 = grupo1.match(/(\d+)([a-z]*)/);
  const match2 = grupo2.match(/(\d+)([a-z]*)/);
  
  if (!match1 || !match2) return false;
  
  const [, num1, letra1] = match1;
  const [, num2, letra2] = match2;
  
  // Grupos adyacentes (diferencia de 1) con misma letra
  const numDiff = Math.abs(parseInt(num1) - parseInt(num2));
  
  // Son similares si: misma letra Y (mismo número O números adyacentes)
  return letra1 === letra2 && numDiff <= 1;
}

// Función principal para buscar coincidencias
async function buscarAlumnoSimilar(nombre, grupo) {
  // 1. Buscar primero en el grupo exacto
  let { data: registrosExactos } = await supabase
    .from('alumnos')
    .select('*')
    .eq('grupo', grupo);
  
  let candidato = buscarMejorCoincidencia(nombre, registrosExactos);
  if (candidato && candidato.similitud >= 0.7) {
    return candidato;
  }
  
  // 2. Buscar en grupos similares (por si se equivocó de número)
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
  
  // 3. Búsqueda amplia con umbral más alto
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
    
    // Calcular ambas similitudes
    const simPalabras = similitudPorPalabras(nombre, nombreRegistro);
    const simTexto = similitudTextoCompleto(nombre, nombreRegistro);
    
    // Usar el promedio ponderado (dar más peso a palabras)
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

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  let nombre = normalizarTexto(document.getElementById('nombre').value);
  let grupo = normalizarTexto(document.getElementById('grupo').value);
  
  // Buscar alumno similar
  const candidato = await buscarAlumnoSimilar(nombre, grupo);
  
  if (candidato) {
    const registro = candidato.registro;
    const nuevasAsistencias = registro.asistencias + 1;
    const nuevasHoras = nuevasAsistencias * 5;
    
    await supabase
      .from('alumnos')
      .update({ asistencias: nuevasAsistencias, horas: nuevasHoras })
      .eq('id', registro.id);
    
    // Mostrar mensaje indicando si hubo corrección
    if (candidato.nombreOriginal !== nombre || candidato.grupoOriginal !== grupo) {
      mensaje.textContent = `✅ Asistencia registrada para ${candidato.nombreOriginal} (${candidato.grupoOriginal}) - ${nuevasHoras} horas acumuladas.`;
      mensaje.style.background = '#fff3cd';
    } else {
      mensaje.textContent = `✅ Asistencia registrada (${nuevasHoras} horas acumuladas).`;
      mensaje.style.background = '#d4edda';
    }
  } else {
    // Nuevo alumno
    await supabase
      .from('alumnos')
      .insert([{ 
        nombre: document.getElementById('nombre').value, // Guardar nombre original
        grupo: document.getElementById('grupo').value,    // Guardar grupo original
        asistencias: 1,
        horas: 5
      }]);
    
    mensaje.textContent = "✅ Nuevo alumno registrado con 5 horas.";
    mensaje.style.background = '#d1ecf1';
  }
  
  form.reset();
  
  // Ocultar mensaje después de 5 segundos
  setTimeout(() => {
    mensaje.textContent = '';
    mensaje.style.background = '';
  }, 5000);
});