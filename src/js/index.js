import { DatabaseManager } from './indexedDB.js';

// Select key DOM elements for interaction
const noteColorInput = document.querySelector("#noteColor");
const addInput = document.querySelector("#addButton");
const mainElement = document.querySelector("main");

// Global variables to manage note stacking and database
let zIndexValue = 1;  // Tracks the stacking order of notes
let databaseManager;  // Manages IndexedDB operations

/**
 * Initializes the database connection and loads existing notes
 * This is the entry point for setting up the application's persistent storage
 */
async function initDatabase() {
  // Get a singleton instance of the DatabaseManager
  databaseManager = DatabaseManager.getInstance();
  
  // Open the database connection
  await databaseManager.open();
  
  // Load any previously saved notes
  await loadExistingNotes();
}

/**
 * Retrieves and loads all existing notes from IndexedDB
 * Ensures notes are restored in their previous stacking order
 */
async function loadExistingNotes() {
  try {
    // Fetch all notes from the database
    const notes = await databaseManager.readAllData();
    
    // Sort notes by their z-index to maintain previous stacking order
    // If a note has no z-index, it defaults to 0
    notes.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    
    // Create DOM elements for each stored note
    notes.forEach(note => {
      createNoteFromDatabase(note);
    });
  } catch (error) {
    // Log any errors during note loading
    console.error("Error loading notes:", error);
  }
}

/**
 * Reconstructs a note from stored database data
 * Restores all note properties: position, z-index, color, and text
 * @param {Object} noteData - The note data retrieved from IndexedDB
 */
function createNoteFromDatabase(noteData) {
  // Create the main note container
  let newNote = document.createElement("div");
  newNote.classList = "note";
  newNote.id = `note-${noteData.id}`;
  
  // Restore note position if previously saved
  if (noteData.position) {
    newNote.style.left = `${noteData.position.x}px`;
    newNote.style.top = `${noteData.position.y}px`;
  }

  // Restore z-index and update global z-index tracker
  if (noteData.zIndex) {
    newNote.style.zIndex = noteData.zIndex;
    // Ensure future notes start with a higher z-index
    zIndexValue = Math.max(zIndexValue, noteData.zIndex + 1);
  }

  // Create note header with delete button
  let noteHeader = document.createElement("div");
  noteHeader.classList = "noteHeader";
  noteHeader.innerHTML = `<button class="delete">X</button>`;
  
  // Restore note header color
  if (noteData.color) {
    noteHeader.style.background = noteData.color;
  }
  
  newNote.appendChild(noteHeader);

  // Create note content area with textarea
  let noteContent = document.createElement("div");
  noteContent.classList = "noteContent";
  
  const textarea = document.createElement("textarea");
  textarea.name = "noteText";
  textarea.id = "noteText";
  textarea.value = noteData.text || '';
  noteContent.appendChild(textarea);
  
  newNote.appendChild(noteContent);

  // Add note to the main document
  mainElement.appendChild(newNote);
}

/**
 * Event listener for adding a new note
 * Creates a new note with selected color and saves it to IndexedDB
 */
addInput.addEventListener("click", async () => {
  // Create note container
  let newNote = document.createElement("div");
  newNote.classList = "note";

  // Create note header with delete button
  let noteHeader = document.createElement("div");
  noteHeader.classList = "noteHeader";
  noteHeader.innerHTML = `<button class="delete">X</button>`;
  newNote.appendChild(noteHeader);

  // Create note content area
  let noteContent = document.createElement("div");
  noteContent.classList = "noteContent";
  noteContent.innerHTML = `<textarea name="noteText" id="noteText"></textarea>`;
  newNote.appendChild(noteContent);

  // Set header color based on color input
  noteHeader.style.background = noteColorInput.value;

  // Save note to IndexedDB
  try {
    const noteData = {
      color: noteColorInput.value,
      text: '',
      position: { x: 0, y: 0 },
      zIndex: zIndexValue  // Assign current z-index
    };
    
    // Create note in database and get its ID
    const result = await databaseManager.createData(noteData);
    newNote.id = `note-${result.result}`;
    
    // Set note's z-index and increment global z-index
    newNote.style.zIndex = zIndexValue;
    zIndexValue++;
  } catch (error) {
    console.error("Error saving note:", error);
  }

  // Add note to the document
  mainElement.appendChild(newNote);
});

/**
 * Event listener for deleting a note
 * Removes note from DOM and IndexedDB when delete button is clicked
 */
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains('delete')) {
    const note = event.target.closest('.note');
    const noteId = parseInt(note.id.split('-')[1]);
    
    try {
      // Delete note from database
      await databaseManager.deleteData(noteId);
      // Remove note from DOM
      note.remove();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  }
});

// Variables to track note dragging state
let cursor = { x: null, y: null }
let note = { dom: null, x: null, y: null }

/**
 * Event listener for starting note drag
 * Prepares note for movement and updates its z-index
 */
document.addEventListener("mousedown", (event) => {
  if (event.target.classList.contains('noteHeader')) {
    // Store initial cursor position
    cursor = {
      x: event.clientX,
      y: event.clientY
    }

    // Get the note being dragged
    let current = event.target.closest('.note');

    // Store note's initial position
    note = {
      dom: current,
      x: current.getBoundingClientRect().left,
      y: current.getBoundingClientRect().top
    }

    // Update note's visual state and z-index
    current.style.cursor = "grabbing";
    current.style.zIndex = zIndexValue;
    zIndexValue++;
  }
});

/**
 * Event listener for dragging a note
 * Updates note position based on mouse movement
 */
document.addEventListener("mousemove", (event) => {
  // Only move if a note is being dragged
  if (note.dom == null) { return; }

  // Calculate new cursor position
  let currentCursor = {
    x: event.clientX,
    y: event.clientY
  }

  // Calculate movement distance
  let distance = {
    x: currentCursor.x - cursor.x,
    y: currentCursor.y - cursor.y
  }

  // Update note's position
  note.dom.style.left = `${note.x + distance.x}px`;
  note.dom.style.top = `${note.y + distance.y}px`;
});

/**
 * Event listener for ending note drag
 * Saves updated note position and z-index to IndexedDB
 */
document.addEventListener("mouseup", async (event) => {
  if (note.dom) {
    // Get note ID
    const noteId = parseInt(note.dom.id.split('-')[1]);
    
    // Calculate new position
    const newPosition = {
      x: parseInt(note.dom.style.left),
      y: parseInt(note.dom.style.top)
    };

    try {
      // Update note position and z-index in database
      await databaseManager.updateData(noteId, { 
        position: newPosition,
        zIndex: parseInt(note.dom.style.zIndex)
      });
    } catch (error) {
      console.error("Error updating note position:", error);
    }
  }

  // Reset dragging state
  note.dom = null;
  event.target.parentNode.style.cursor = "grab";
});

/**
 * Event listener for updating note text
 * Saves note text to IndexedDB when content changes
 */
document.addEventListener('input', async (event) => {
  if (event.target.id === 'noteText') {
    const note = event.target.closest('.note');
    const noteId = parseInt(note.id.split('-')[1]);
    const text = event.target.value;

    try {
      // Update note text in database
      await databaseManager.updateData(noteId, { text });
    } catch (error) {
      console.error("Error updating note text:", error);
    }
  }
});

// Initialize the application when page loads
initDatabase();