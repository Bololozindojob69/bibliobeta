-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: bibliobeta
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `administradores`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `administradores` (
  `id` int DEFAULT NULL,
  `usuario_id` int NOT NULL,
  `escola_id` int NOT NULL,
  `data_nascimento` text,
  `rg` text,
  `cargo` text,
  `nivel_acesso` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administradores`
--

LOCK TABLES `administradores` WRITE;
/*!40000 ALTER TABLE `administradores` DISABLE KEYS */;
/*!40000 ALTER TABLE `administradores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `alunos`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alunos` (
  `id` int DEFAULT NULL,
  `usuario_id` int NOT NULL,
  `escola_id` int NOT NULL,
  `ra` text NOT NULL,
  `serie` text,
  `turma` text,
  `numero_chamada` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alunos`
--

LOCK TABLES `alunos` WRITE;
/*!40000 ALTER TABLE `alunos` DISABLE KEYS */;
INSERT INTO `alunos` VALUES (1,1,1,'123456-7','3º ano do Ensino Médio','A',NULL),(2,2,1,'111111-1','1o ano A','1o ano A',NULL);
/*!40000 ALTER TABLE `alunos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `escolas`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `escolas` (
  `id` int DEFAULT NULL,
  `nome` text NOT NULL,
  `cnpj` text,
  `codigo_inep` text,
  `telefone` text,
  `email` text,
  `cep` text,
  `estado` text,
  `cidade` text,
  `endereco` text,
  `numero` text,
  `complemento` text,
  `diretor` text,
  `status` text NOT NULL,
  `criado_em` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `escolas`
--

LOCK TABLES `escolas` WRITE;
/*!40000 ALTER TABLE `escolas` DISABLE KEYS */;
INSERT INTO `escolas` VALUES (1,'BiblioBeta - Escola de Teste',NULL,NULL,'(11) 99999-9999','escola@bibliobeta.local',NULL,'SP','São Paulo','Rua de Teste, 100',NULL,NULL,NULL,'ativa','2026-08-19 22:17:18');
/*!40000 ALTER TABLE `escolas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `livros`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `livros` (
  `id` int DEFAULT NULL,
  `escola_id` int NOT NULL,
  `titulo` text NOT NULL,
  `autor` text NOT NULL,
  `editora` text,
  `isbn` text,
  `ano_publicacao` int DEFAULT NULL,
  `categoria` text,
  `descricao` text,
  `capa` text,
  `quantidade` int NOT NULL,
  `disponiveis` int NOT NULL,
  `ativo` int NOT NULL,
  `criado_em` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `livros`
--

LOCK TABLES `livros` WRITE;
/*!40000 ALTER TABLE `livros` DISABLE KEYS */;
INSERT INTO `livros` VALUES (1,1,'Dom Casmurro','Machado de Assis',NULL,NULL,NULL,'Literatura',NULL,NULL,5,5,1,'2026-08-19 22:17:18'),(2,1,'O Pequeno Príncipe','Antoine de Saint-Exupéry',NULL,NULL,NULL,'Infantil',NULL,NULL,4,4,1,'2026-08-19 22:17:18'),(3,1,'1984','George Orwell',NULL,NULL,NULL,'Ficção',NULL,NULL,3,3,1,'2026-08-19 22:17:18');
/*!40000 ALTER TABLE `livros` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `professores`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `professores` (
  `id` int DEFAULT NULL,
  `usuario_id` int NOT NULL,
  `escola_id` int NOT NULL,
  `matricula` text,
  `disciplina` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `professores`
--

LOCK TABLES `professores` WRITE;
/*!40000 ALTER TABLE `professores` DISABLE KEYS */;
/*!40000 ALTER TABLE `professores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios`
--

/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` int DEFAULT NULL,
  `escola_id` int NOT NULL,
  `nome` text NOT NULL,
  `email` text NOT NULL,
  `telefone` text,
  `senha_hash` text NOT NULL,
  `tipo` text NOT NULL,
  `status` text NOT NULL,
  `criado_em` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios`
--

LOCK TABLES `usuarios` WRITE;
/*!40000 ALTER TABLE `usuarios` DISABLE KEYS */;
INSERT INTO `usuarios` VALUES (1,1,'Aluno Demonstração','aluno@bibliobeta.local','(11) 98888-8888','$2b$10$1foQEUUzbFw2M2SFZtv3fO8XPNEfINdbQV34S6K/VJORSwBRyyALG','aluno','ativo','2026-08-19 22:17:18'),(2,1,'Teste Terminal','teste.terminal@exemplo.com','11999998888','$2b$10$WxajVw4Lr.xTUq0FM7ofj.busS3fGt6j.79y8G4Ckpqw46uYP2hyO','aluno','ativo','2026-08-20 14:12:31');
/*!40000 ALTER TABLE `usuarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'bibliobeta'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-24 11:02:05
