<?php
// Fichier: models/UniversManager.php

class UniversManager {

    private $db;

    public function __construct(PDO $db) {
        $this->db = $db;
    }

    public function getUniversById(int $id) {
        $stmt = $this->db->prepare("SELECT * FROM univers WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getUniversByIds(array $ids) {
        if (empty($ids)) {
            return [];
        }
        $in = str_repeat('?,', count($ids) - 1) . '?';
        $sql = "SELECT * FROM univers WHERE id IN ($in)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($ids);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getAllUnivers() {
        return $this->db->query("SELECT id, nom, zone_assignee FROM univers ORDER BY nom")->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getOrCreateUniversId(string $nom, string $zone): int {
        if (empty(trim($nom))) {
            $nom = "Indéfini";
        }
        
        $stmt = $this->db->prepare("SELECT id FROM univers WHERE nom = ?");
        $stmt->execute([$nom]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            return (int)$result['id'];
        } else {
            $this->addUnivers($nom, $zone);
            return (int)$this->db->lastInsertId();
        }
    }

    public function addUnivers(string $nom, string $zone) {
        $sql = "INSERT INTO univers (nom, zone_assignee) VALUES (?, ?)";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$nom, $zone]);
    }

    public function deleteUnivers(int $id) {
        $checkSql = "SELECT COUNT(*) FROM geo_codes WHERE univers_id = ?";
        $checkStmt = $this->db->prepare($checkSql);
        $checkStmt->execute([$id]);
        if ($checkStmt->fetchColumn() > 0) {
            return false;
        }
        $sql = "DELETE FROM univers WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$id]);
    }
    
    public function updateUniversZone(int $id, string $zone): bool {
        if (!in_array($zone, ['vente', 'reserve'])) {
            return false;
        }
        $sql = "UPDATE univers SET zone_assignee = ? WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([$zone, $id]);
    }

    // --- MÉTHODES POUR LE DASHBOARD ---
    public function countTotalUnivers(): int {
        return (int)$this->db->query("SELECT COUNT(*) FROM univers")->fetchColumn();
    }

    public function countUniversByZone(): array {
        $sql = "
            SELECT zone_assignee, COUNT(id) as count
            FROM univers
            GROUP BY zone_assignee
        ";
        return $this->db->query($sql)->fetchAll(PDO::FETCH_KEY_PAIR);
    }
}
