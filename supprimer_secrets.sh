#!/bin/bash

echo "📥 Téléchargement de BFG..."
curl -L https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -o bfg.jar

echo "🔒 Suppression du fichier contenant un secret..."
java -jar bfg.jar --delete-files 'uploads/e39d8835-c94f-4670-a8f0-c15a7331db37-.python.exe app.py.txt'

echo "🧹 Nettoyage de l'historique Git..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "🚀 Push forcé vers GitHub..."
git push --force

echo "✅ Fichier supprimé de l'historique et dépôt mis à jour !"
