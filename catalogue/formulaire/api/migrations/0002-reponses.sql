-- Réponses au formulaire : une ligne par envoi, valeurs en JSON (clé = identifiant de question).
CREATE TABLE reponses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recueillie_le TEXT NOT NULL,
  valeurs TEXT NOT NULL
);
