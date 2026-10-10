'use strict';
window.SQL_DATA = {
  DB: {
    animales: {
      cols: [
        ['id', 'INT'],
        ['nombre', 'VARCHAR'],
        ['categoria', 'VARCHAR'],
        ['edad', 'INT'],
        ['habitat', 'VARCHAR']
      ],
      rows: [
        [1, 'Gato', 'Domestico', 4, 'Hogar'],
        [2, 'Perro', 'Domestico', 6, 'Hogar'],
        [3, 'Loro', 'Domestico', 2, 'Hogar'],
        [4, 'Elefante', 'Salvaje', 25, 'Sabana'],
        [5, 'Leon', 'Salvaje', 9, 'Sabana']
      ]
    },
    estudiantes: {
      cols: [
        ['id', 'INT'],
        ['nombre', 'VARCHAR'],
        ['edad', 'INT'],
        ['curso', 'VARCHAR']
      ],
      rows: [
        [1, 'Ana', 13, 'SQL Basico'],
        [2, 'Luis', 15, 'SQL Basico'],
        [3, 'Sofia', 14, 'SQL Avanzado']
      ]
    }
  },
  EX: [
    {
      id: 1,
      cls: 'SELECT & FROM',
      title: 'Tu primera consulta SELECT',
      desc: 'Sintaxis elemental, tablas virtuales y selección de campos.',
      diff: 'Principiante',
      mission: 'Escribe una consulta SQL que extraiga <code>nombre</code>, <code>categoria</code> y <code>habitat</code> de la tabla <code>animales</code>.',
      hint: 'Usa SELECT con las columnas separadas por comas y luego FROM animales.',
      sol: 'SELECT nombre, categoria, habitat FROM animales'
    },
    {
      id: 2,
      cls: 'WHERE',
      title: 'Filtrando datos con WHERE',
      desc: 'Uso de operadores numéricos, cadenas de texto y comparaciones lógicas.',
      diff: 'Principiante',
      mission: 'Extrae <code>nombre</code>, <code>categoria</code> y <code>habitat</code> de <code>animales</code>, pero solo los de categoría <code>\'Domestico\'</code>.',
      hint: "Agrega WHERE categoria = 'Domestico' al final. El texto va entre comillas simples.",
      sol: "SELECT nombre, categoria, habitat FROM animales WHERE categoria = 'Domestico'"
    },
    {
      id: 3,
      cls: 'DISTINCT',
      title: 'Desafío de valores DISTINCT',
      desc: 'Limpia registros duplicados en una base de datos de naves espaciales.',
      diff: 'Intermedio',
      mission: 'Muestra cada <code>categoria</code> de la tabla <code>animales</code> una sola vez, sin repetirla.',
      hint: 'DISTINCT va justo después de SELECT.',
      sol: 'SELECT DISTINCT categoria FROM animales'
    },
    {
      id: 4,
      cls: 'ORDER BY',
      title: 'Ordenando resultados',
      desc: 'Ordena de mayor a menor con ORDER BY.',
      diff: 'Intermedio',
      mission: 'Muestra <code>nombre</code> y <code>edad</code> de <code>animales</code> ordenados del más viejo al más joven.',
      hint: 'ORDER BY edad DESC al final de la consulta.',
      sol: 'SELECT nombre, edad FROM animales ORDER BY edad DESC'
    }
  ]
};