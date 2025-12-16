const notesContainter = document.getElementById("app");
const addMusicButton = notesContainter.querySelector(".add-note");
const url = "./src/api.php";

// Load notes from server on page load
getNotes().then(notes => {
    notes.forEach(note => {
        const noteElement = createNoteElement(note.id, note.content);
        notesContainter.insertBefore(noteElement, addMusicButton);
    });
});

async function getNotes() {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch notes");
        return await response.json();
    } catch (error) {
        console.error("Error fetching notes:", error);
        return [];
    }
}

async function saveNotes(notes) {
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notes)
        });
        if (!response.ok) throw new Error("Failed to save notes");
    } catch (error) {
        console.error("Error saving notes:", error);
    }
}

function createNoteElement(id, content) {
    const element = document.createElement("textarea");
    element.classList.add("note");
    element.value = content;
    element.placeholder = "Empty Music Suggestion";

    element.addEventListener("change", () => updateNote(id, element.value));
    element.addEventListener("dblclick", () => {
        const doDelete = confirm("Are you sure you want to delete this piece?");
        if (doDelete) deleteNote(id, element);
    });

    return element;
}

async function addNote() {
    const notesObject = {
        id: Math.floor(Math.random() * 100000),
        content: ""
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(notesObject)
        });
        if (!response.ok) throw new Error("Failed to add note");
        
        const noteElement = createNoteElement(notesObject.id, notesObject.content);
        notesContainter.insertBefore(noteElement, addMusicButton);
    } catch (error) {
        console.error("Error adding note:", error);
    }
}

async function updateNote(id, newContent) {
    try {
        const response = await fetch(`${url}?id=${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: newContent })
        });
        if (!response.ok) throw new Error("Failed to update note");
    } catch (error) {
        console.error("Error updating note:", error);
    }
}

async function deleteNote(id, element) {
    try {
        const response = await fetch(`${url}?id=${id}`, {
            method: "DELETE"
        });
        if (!response.ok && response.status !== 204) throw new Error("Failed to delete note");
        notesContainter.removeChild(element);
    } catch (error) {
        console.error("Error deleting note:", error);
    }
}

addMusicButton.addEventListener("click", () => addNote());