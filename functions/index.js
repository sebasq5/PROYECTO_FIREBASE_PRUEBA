const express = require("express");
const admin = require("firebase-admin");
const { Timestamp } = require("firebase-admin/firestore");

function getFirebaseCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const serviceAccountJson = Buffer
      .from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64")
      .toString("utf8");

    return JSON.parse(serviceAccountJson);
  }

  return require("./serviceAccountKey.json");
}

const serviceAccount = getFirebaseCredential();

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const db = admin.firestore();
const moviesRouter = express.Router();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const MOVIES_COLLECTION = "movies";

// Convierte un documento de Firestore en una respuesta JSON con su ID.
function buildMovieResponse(doc) {
  return {
    id: doc.id,
    ...doc.data(),
  };
}

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

// Valida los campos obligatorios para crear o reemplazar una pelicula.
function validateRequiredMovieFields(body) {
  const missingFields = [];

  if (isEmpty(body.title)) {
    missingFields.push("title");
  }

  if (isEmpty(body.genre)) {
    missingFields.push("genre");
  }

  if (isEmpty(body.year)) {
    missingFields.push("year");
  }

  return missingFields;
}

// Normaliza los datos recibidos antes de guardarlos en Firestore.
function normalizeMoviePayload(body, includeCreatedAt = false) {
  const movie = {
    title: String(body.title).trim(),
    genre: String(body.genre).trim(),
    year: Number(body.year),
    available: body.available === undefined ? true : Boolean(body.available),
  };

  if (includeCreatedAt) {
    movie.createdAt = Timestamp.now();
  }

  return movie;
}

function validateYear(year) {
  return Number.isInteger(year) && year > 0;
}

// Endpoint de estado para verificar que la API esta activa.
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "CineFlex API",
  });
});

// GET /movies: lista todas las peliculas.
moviesRouter.get("/", async (req, res) => {
  try {
    const snapshot = await db
      .collection(MOVIES_COLLECTION)
      .orderBy("createdAt", "desc")
      .get();

    const movies = snapshot.docs.map(buildMovieResponse);

    return res.status(200).json({
      data: movies,
      total: movies.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// GET /movies/:id: obtiene una pelicula por ID.
moviesRouter.get("/:id", async (req, res) => {
  try {
    const movieRef = db.collection(MOVIES_COLLECTION).doc(req.params.id);
    const movieSnapshot = await movieRef.get();

    if (!movieSnapshot.exists) {
      return res.status(404).json({
        error: "Pelicula no encontrada",
      });
    }

    return res.status(200).json({
      data: buildMovieResponse(movieSnapshot),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// POST /movies: crea una pelicula nueva.
moviesRouter.post("/", async (req, res) => {
  try {
    const missingFields = validateRequiredMovieFields(req.body);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Datos incompletos",
        fields: missingFields,
      });
    }

    const movie = normalizeMoviePayload(req.body, true);

    if (!validateYear(movie.year)) {
      return res.status(400).json({
        error: "El campo year debe ser un numero entero positivo",
      });
    }

    const movieRef = await db.collection(MOVIES_COLLECTION).add(movie);

    return res.status(201).json({
      message: "Pelicula creada correctamente",
      data: {
        id: movieRef.id,
        ...movie,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// PUT /movies/:id: actualiza una pelicula existente.
moviesRouter.put("/:id", async (req, res) => {
  try {
    const movieRef = db.collection(MOVIES_COLLECTION).doc(req.params.id);
    const movieSnapshot = await movieRef.get();

    if (!movieSnapshot.exists) {
      return res.status(404).json({
        error: "Pelicula no encontrada",
      });
    }

    const missingFields = validateRequiredMovieFields(req.body);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Datos incompletos",
        fields: missingFields,
      });
    }

    const movie = normalizeMoviePayload(req.body);

    if (!validateYear(movie.year)) {
      return res.status(400).json({
        error: "El campo year debe ser un numero entero positivo",
      });
    }

    await movieRef.update(movie);

    return res.status(200).json({
      message: "Pelicula actualizada correctamente",
      data: {
        id: movieRef.id,
        ...movieSnapshot.data(),
        ...movie,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

// DELETE /movies/:id: elimina una pelicula existente.
moviesRouter.delete("/:id", async (req, res) => {
  try {
    const movieRef = db.collection(MOVIES_COLLECTION).doc(req.params.id);
    const movieSnapshot = await movieRef.get();

    if (!movieSnapshot.exists) {
      return res.status(404).json({
        error: "Pelicula no encontrada",
      });
    }

    await movieRef.delete();

    return res.status(200).json({
      message: "Pelicula eliminada correctamente",
      data: {
        id: movieRef.id,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
});

app.use("/movies", moviesRouter);

app.use((req, res) => {
  return res.status(404).json({
    error: "Ruta no encontrada",
  });
});

app.listen(PORT, () => {
  console.log(`CineFlex API running on port ${PORT}`);
});
