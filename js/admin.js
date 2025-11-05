let alumnoAEliminar = null;
let alumnoAEditar = null;

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'exito') {
  const notificacion = document.createElement('div');
  notificacion.className = `mensaje-notificacion mensaje-${tipo}`;
  notificacion.textContent = mensaje;
  document.body.appendChild(notificacion);
  
  setTimeout(() => {
    notificacion.style.animation = 'slideInRight 0.3s reverse';
    setTimeout(() => notificacion.remove(), 300);
  }, 3000);
}

async function cargarTabla() {
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('*')
    .order('grupo', { ascending: true });

  const tbody = document.getElementById('contenido');
  tbody.innerHTML = "";

  if (alumnos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999;">No hay registros</td></tr>';
    return;
  }

  alumnos.forEach(a => {
    const fila = `
      <tr>
        <td>${a.nombre}</td>
        <td>${a.grupo}</td>
        <td>${a.asistencias}</td>
        <td>${a.horas}</td>
        <td>
          <button class="btn btn-editar" onclick="mostrarModalEditar(${a.id}, '${a.nombre}', ${a.horas})">
            ✏️ Editar
          </button>
          <button class="btn btn-eliminar" onclick="mostrarModalEliminar(${a.id}, '${a.nombre}')">
            ✕ Eliminar
          </button>
        </td>
      </tr>`;
    tbody.innerHTML += fila;
  });
}

// Exportar a Excel
document.getElementById('exportar').addEventListener('click', () => {
  const tabla = document.getElementById('tabla');
  const wb = XLSX.utils.table_to_book(tabla, { sheet: "Horas" });
  XLSX.writeFile(wb, "asistencias.xlsx");
  mostrarNotificacion('✅ Archivo Excel descargado correctamente');
});

// Modal para vaciar BD
const modalVaciar = document.getElementById('modalVaciar');
const btnVaciar = document.getElementById('vaciarBD');
const btnConfirmarVaciar = document.getElementById('confirmarVaciar');
const btnCancelarVaciar = document.getElementById('cancelarVaciar');

btnVaciar.addEventListener('click', () => {
  modalVaciar.style.display = 'block';
});

btnCancelarVaciar.addEventListener('click', () => {
  modalVaciar.style.display = 'none';
});

btnConfirmarVaciar.addEventListener('click', async () => {
  try {
    const { error } = await supabase
      .from('alumnos')
      .delete()
      .neq('id', 0);
    
    if (error) throw error;
    
    modalVaciar.style.display = 'none';
    await cargarTabla();
    mostrarNotificacion('✅ Base de datos vaciada correctamente');
  } catch (error) {
    mostrarNotificacion('❌ Error al vaciar la base de datos', 'error');
    console.error(error);
  }
});

// Modal para eliminar alumno individual
const modalEliminar = document.getElementById('modalEliminar');
const btnConfirmarEliminar = document.getElementById('confirmarEliminar');
const btnCancelarEliminar = document.getElementById('cancelarEliminar');

window.mostrarModalEliminar = (id, nombre) => {
  alumnoAEliminar = id;
  document.getElementById('textoEliminar').innerHTML = 
    `¿Estás seguro de eliminar a <strong>${nombre}</strong>?`;
  modalEliminar.style.display = 'block';
};

btnCancelarEliminar.addEventListener('click', () => {
  modalEliminar.style.display = 'none';
  alumnoAEliminar = null;
});

btnConfirmarEliminar.addEventListener('click', async () => {
  if (!alumnoAEliminar) return;
  
  try {
    const { error } = await supabase
      .from('alumnos')
      .delete()
      .eq('id', alumnoAEliminar);
    
    if (error) throw error;
    
    modalEliminar.style.display = 'none';
    alumnoAEliminar = null;
    await cargarTabla();
    mostrarNotificacion('✅ Alumno eliminado correctamente');
  } catch (error) {
    mostrarNotificacion('❌ Error al eliminar el alumno', 'error');
    console.error(error);
  }
});

// Modal para editar horas de alumno
const modalEditar = document.getElementById('modalEditar');
const btnConfirmarEditar = document.getElementById('confirmarEditar');
const btnCancelarEditar = document.getElementById('cancelarEditar');
const inputHoras = document.getElementById('inputHoras');

window.mostrarModalEditar = (id, nombre, horasActuales) => {
  alumnoAEditar = id;
  document.getElementById('textoEditar').innerHTML = 
    `Editando horas de <strong>${nombre}</strong>`;
  inputHoras.value = horasActuales;
  inputHoras.focus();
  modalEditar.style.display = 'block';
};

btnCancelarEditar.addEventListener('click', () => {
  modalEditar.style.display = 'none';
  alumnoAEditar = null;
});

btnConfirmarEditar.addEventListener('click', async () => {
  if (!alumnoAEditar) return;
  
  const nuevasHoras = parseFloat(inputHoras.value);
  
  if (isNaN(nuevasHoras) || nuevasHoras < 0) {
    mostrarNotificacion('❌ Por favor ingresa un número válido de horas', 'error');
    return;
  }
  
  try {
    const { error } = await supabase
      .from('alumnos')
      .update({ horas: nuevasHoras })
      .eq('id', alumnoAEditar);
    
    if (error) throw error;
    
    modalEditar.style.display = 'none';
    alumnoAEditar = null;
    await cargarTabla();
    mostrarNotificacion('✅ Horas actualizadas correctamente');
  } catch (error) {
    mostrarNotificacion('❌ Error al actualizar las horas', 'error');
    console.error(error);
  }
});

// Permitir guardar con Enter en el input
inputHoras.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnConfirmarEditar.click();
  }
});

// Cerrar modales al hacer clic fuera
window.addEventListener('click', (e) => {
  if (e.target === modalVaciar) {
    modalVaciar.style.display = 'none';
  }
  if (e.target === modalEliminar) {
    modalEliminar.style.display = 'none';
    alumnoAEliminar = null;
  }
  if (e.target === modalEditar) {
    modalEditar.style.display = 'none';
    alumnoAEditar = null;
  }
});

// Cargar tabla al inicio
cargarTabla();