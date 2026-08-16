/* =========================================================
   TÉMOIGNAGES RELANCE CHANTIER — données éditables à la main.

   Comment ajouter un témoignage (pas besoin de savoir coder) :
   1. Copiez un bloc { ... } (voir exemple en commentaire plus bas),
      collez-le entre les crochets [ ] ci-dessous.
   2. Remplissez les champs (voir le détail de chacun plus bas).
   3. Sauvegardez le fichier — le témoignage apparaît automatiquement
      sur le site, aucune autre modification n'est nécessaire.

   Champs disponibles pour chaque témoignage :
   - prenom      (obligatoire) Prénom du client. Ex: "Kevin"
   - role        (obligatoire) Son métier. Ex: "Maçon"
   - ville       (optionnel)   Sa ville. Ex: "Rennes"
   - citation    (obligatoire) Le témoignage, mot pour mot si possible.
   - note        (optionnel)   Note sur 5 (nombre entier de 1 à 5) — UNIQUEMENT
                                si le client vous a donné une note explicite
                                (ex: avis Google 5 étoiles). Ne jamais deviner
                                ou inventer une note.
   - lienSource  (optionnel)   Lien vers l'avis d'origine (Google, LinkedIn...).
                                Pour un avis Google : ouvrez votre fiche
                                Google Business Profile > Avis > cliquez sur
                                l'avis > icône de partage > copier le lien.
   - lienLabel   (optionnel)   Texte du lien. Ex: "Avis Google"
                                (par défaut : "Voir l'avis original")
   - photo       (optionnel)   Chemin ou URL vers une photo du client.
   - dateAjout   (obligatoire) Date à laquelle VOUS avez ajouté ce témoignage
                                ici, format AAAA-MM-JJ. C'est un repère interne,
                                pas la date du témoignage lui-même.

   Exemple (à copier-coller et remplir) :
   {
     prenom: "Kevin",
     role: "Maçon",
     ville: "Rennes",
     citation: "Le vrai retour du client, mot pour mot si possible.",
     note: 5,
     lienSource: "https://...",
     lienLabel: "Avis Google",
     dateAjout: "2026-08-16"
   },

   RÈGLE IMPORTANTE : n'ajoutez ici QUE de vrais retours de vrais clients,
   obtenus avec leur accord. Ne jamais inventer un prénom, une citation,
   une ville ou une note. Un tableau vide masque simplement la section —
   c'est très bien en attendant d'avoir de vrais retours.
   ========================================================= */
window.RC_TESTIMONIALS = [];
