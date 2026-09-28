-- MySQL dump 10.13  Distrib 5.7.44, for Linux (x86_64)
--
-- Host: localhost    Database: etp_default_sql
-- ------------------------------------------------------
-- Server version	5.7.44-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `file_list`
--

DROP TABLE IF EXISTS `file_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `file_list` (
  `file_id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(36) NOT NULL,
  `business_type` varchar(50) NOT NULL,
  `business_id` int(11) NOT NULL,
  `file_type` varchar(20) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `storage_name` varchar(255) NOT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `size` int(11) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`file_id`),
  UNIQUE KEY `IDX_15046c43dad32c4023b7f2fdae` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `file_list`
--

LOCK TABLES `file_list` WRITE;
/*!40000 ALTER TABLE `file_list` DISABLE KEYS */;
/*!40000 ALTER TABLE `file_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `import_history`
--

DROP TABLE IF EXISTS `import_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `import_history` (
  `import_history_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '历史导入ID',
  `import_menu_name` varchar(255) NOT NULL COMMENT '导入菜单名',
  `import_time` datetime NOT NULL COMMENT '导入时间',
  `import_file_name` varchar(255) NOT NULL COMMENT '导入文件名',
  `import_total` int(11) NOT NULL COMMENT '导入数据量',
  PRIMARY KEY (`import_history_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `import_history`
--

LOCK TABLES `import_history` WRITE;
/*!40000 ALTER TABLE `import_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `import_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_list`
--

DROP TABLE IF EXISTS `menu_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menu_list` (
  `menu_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '菜单id',
  `menu_name` varchar(30) NOT NULL COMMENT '菜单名称',
  `menu_icon` varchar(30) NOT NULL COMMENT '菜单icon',
  `table_name` varchar(30) DEFAULT NULL COMMENT '数据表名',
  `component_name` varchar(30) DEFAULT NULL COMMENT '组件名称',
  `component_address` varchar(255) DEFAULT NULL COMMENT '组件地址',
  `menu_type` tinyint(10) NOT NULL DEFAULT '0' COMMENT '菜单状态',
  `is_cached` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否缓存',
  `is_show` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否显示',
  `parent_id` int(11) DEFAULT NULL COMMENT '父级目录id',
  `menu_remark` text COMMENT '菜单备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `menu_sort` int(11) NOT NULL DEFAULT '0' COMMENT '菜单排序',
  `print_receipt_id` int(11) DEFAULT NULL COMMENT '绑定打印单据id',
  PRIMARY KEY (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=125 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_list`
--

LOCK TABLES `menu_list` WRITE;
/*!40000 ALTER TABLE `menu_list` DISABLE KEYS */;
INSERT INTO `menu_list` VALUES (1,'系统管理','system-3',NULL,NULL,NULL,0,1,1,0,NULL,'2025-10-27 20:52:23','2026-06-17 15:36:04',0,NULL),(2,'菜单管理','menu-filled','menu_list','MenuManagement','/src/pages/MenuManagement/MenuManagement/index.vue',1,1,1,1,NULL,'2025-10-27 20:52:46','2026-06-11 20:08:06',3,NULL),(16,'用户管理','user-list','user_list','UserAdminPage','/src/pages/MenuManagement/UserAdmin/index.vue',1,1,1,1,'','2026-04-19 17:32:01','2026-06-11 20:08:06',2,NULL),(17,'角色管理','user-circle','role_list','AuthAdminPage','/src/pages/MenuManagement/AuthAdmin/index.vue',1,1,1,1,'','2026-04-19 23:03:38','2026-05-27 15:14:22',1,NULL),(96,'数据导入','download-1',NULL,'DataImport','/src/pages/MenuManagement/DataImport/index.vue',1,1,1,1,'','2026-05-06 13:44:16','2026-05-06 13:44:16',0,NULL),(108,'菜单配置','setting-1',NULL,'MenuSetting','/src/pages/MenuManagement/SystemManagement/MenuSetting/index.vue',1,1,0,1,'','2026-05-27 17:47:07','2026-06-11 20:08:06',4,NULL);
/*!40000 ALTER TABLE `menu_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `menu_status`
--

DROP TABLE IF EXISTS `menu_status`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `menu_status` (
  `menu_status_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '菜单状态ID',
  `menu_id` int(11) NOT NULL COMMENT '菜单ID',
  `column_config` json DEFAULT NULL COMMENT 'TDesign 列配置（JSON数组）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `menu_name` varchar(255) NOT NULL COMMENT '菜单名称',
  PRIMARY KEY (`menu_status_id`),
  UNIQUE KEY `IDX_7516683bb3d508ece77e24ccce` (`menu_id`)
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `menu_status`
--

LOCK TABLES `menu_status` WRITE;
/*!40000 ALTER TABLE `menu_status` DISABLE KEYS */;
INSERT INTO `menu_status` VALUES (5,17,'[{\"align\": \"center\", \"fixed\": \"left\", \"title\": \"序号\", \"width\": 171.23843383789062, \"colKey\": \"index\", \"visible\": true, \"displayIndex\": 0}, {\"align\": \"center\", \"title\": \"角色名称\", \"width\": 285.7731628417969, \"colKey\": \"role_name\", \"sorter\": true, \"visible\": true, \"displayIndex\": 1}, {\"align\": \"center\", \"title\": \"归属单位\", \"width\": 321.8657531738281, \"colKey\": \"role_unit\", \"visible\": true, \"displayIndex\": 2}, {\"align\": \"center\", \"title\": \"归属部门\", \"width\": 226.51622009277344, \"colKey\": \"role_dept\", \"visible\": true, \"displayIndex\": 3}, {\"align\": \"center\", \"title\": \"备注\", \"width\": 310.8333435058594, \"colKey\": \"role_desc\", \"visible\": true, \"displayIndex\": 4}, {\"align\": \"center\", \"fixed\": \"right\", \"title\": \"操作\", \"width\": 303.48382568359375, \"colKey\": \"actions\", \"visible\": true, \"displayIndex\": 5}]','2026-04-29 21:02:07','2026-07-10 10:19:41','角色管理'),(7,16,'[{\"align\": \"center\", \"fixed\": \"left\", \"title\": \"序号\", \"width\": 125.47917175292967, \"colKey\": \"index\", \"visible\": true, \"displayIndex\": 0}, {\"align\": \"center\", \"title\": \"账号\", \"width\": 120.54167175292967, \"colKey\": \"account\", \"sorter\": true, \"visible\": true, \"displayIndex\": 1}, {\"align\": \"center\", \"title\": \"用户名称\", \"width\": 157.1979217529297, \"colKey\": \"username\", \"sorter\": true, \"visible\": true, \"displayIndex\": 2}, {\"align\": \"center\", \"title\": \"职务\", \"width\": 175.58334350585938, \"colKey\": \"role_name\", \"visible\": true, \"displayIndex\": 3}, {\"align\": \"center\", \"title\": \"手机号\", \"width\": 243.39584350585935, \"colKey\": \"phone_number\", \"visible\": true, \"displayIndex\": 4}, {\"align\": \"center\", \"title\": \"邮箱\", \"width\": 194.9479217529297, \"colKey\": \"email\", \"visible\": true, \"displayIndex\": 5}, {\"align\": \"center\", \"title\": \"性别\", \"width\": 261.26043701171875, \"colKey\": \"gender\", \"visible\": true, \"displayIndex\": 6}, {\"align\": \"center\", \"fixed\": \"right\", \"title\": \"操作\", \"width\": 150.59375, \"colKey\": \"actions\", \"visible\": true, \"displayIndex\": 7}]','2026-04-30 15:44:52','2026-07-18 12:15:04','用户管理'),(22,96,'[{\"align\": \"center\", \"fixed\": \"left\", \"title\": \"序号\", \"width\": 137.58680725097656, \"colKey\": \"index\", \"visible\": true, \"displayIndex\": 0}, {\"align\": \"center\", \"title\": \"导入菜单名\", \"width\": 167.4132080078125, \"colKey\": \"import_menu_name\", \"visible\": true, \"displayIndex\": 1}, {\"align\": \"center\", \"title\": \"导入时间\", \"width\": 347.170166015625, \"colKey\": \"import_time\", \"sorter\": true, \"visible\": true, \"displayIndex\": 2}, {\"align\": \"center\", \"title\": \"导入文件名\", \"width\": 299.25347900390625, \"colKey\": \"import_file_name\", \"visible\": true, \"displayIndex\": 3}, {\"align\": \"center\", \"title\": \"导入数据量\", \"width\": 299.375, \"colKey\": \"import_total\", \"sorter\": true, \"visible\": true, \"displayIndex\": 4}]','2026-05-06 20:08:16','2026-06-27 22:39:54','数据导入');
/*!40000 ALTER TABLE `menu_status` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_list`
--

DROP TABLE IF EXISTS `operation_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `operation_list` (
  `operation_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '操作ID',
  `operation_name` varchar(50) NOT NULL COMMENT '操作名称',
  `operation_port` varchar(50) DEFAULT NULL COMMENT '操作接口',
  `operation_method` varchar(10) DEFAULT NULL COMMENT '操作方式',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) COMMENT '更新时间',
  `operation_sign` varchar(100) NOT NULL COMMENT '操作标识',
  `menu_id` int(11) NOT NULL COMMENT '菜单ID',
  PRIMARY KEY (`operation_id`)
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_list`
--

LOCK TABLES `operation_list` WRITE;
/*!40000 ALTER TABLE `operation_list` DISABLE KEYS */;
INSERT INTO `operation_list` VALUES (74,'清空导入历史','excel/clearHistory','GET','2026-05-27 14:43:56.678978','2026-05-27 14:43:56.678978','DataImport.clearImportHistory',96),(75,'导入','excel/import/:menu_id','POST','2026-05-27 14:46:29.980470','2026-05-27 14:46:29.980470','DataImport.importExcel',96),(77,'批量导入','execl/batch-import','POST','2026-05-27 15:04:46.537922','2026-05-27 15:04:46.537922','DataImport.batchImportExcel',96),(78,'添加角色','','','2026-06-11 20:11:25.444222','2026-06-11 20:11:25.444222','AuthAdminPage.add',17),(79,'修改角色','','','2026-06-11 20:12:41.638444','2026-06-11 20:12:41.638444','AuthAdminPage.update',17),(80,'权限配置','','','2026-06-11 20:12:53.746006','2026-06-11 20:12:53.746006','AuthAdminPage.setAuth',17),(81,'删除角色','','','2026-06-11 20:13:02.052463','2026-06-11 20:13:02.052463','AuthAdminPage.delete',17),(82,'添加用户','','','2026-06-11 20:13:31.751806','2026-06-11 20:13:31.751806','UserAdminPage.add',16),(83,'修改用户','','','2026-06-11 20:13:44.402710','2026-06-11 20:13:44.402710','UserAdminPage.update',16),(84,'删除用户','','','2026-06-11 20:13:52.437042','2026-06-11 20:13:52.437042','UserAdminPage.delete',16),(85,'添加菜单','','','2026-06-11 20:14:18.747291','2026-06-11 20:14:18.747291','MenuManagement.add',2),(86,'修改菜单','','','2026-06-11 20:14:52.244703','2026-06-11 20:14:52.244703','MenuManagement.update',2),(87,'删除菜单','','','2026-06-11 20:15:00.127967','2026-06-11 20:15:00.127967','MenuManagement.delete',2),(88,'添加操作','','','2026-06-11 20:15:45.590676','2026-06-11 20:15:45.590676','MenuManagement.addOperation',2),(89,'删除操作','','','2026-06-11 20:16:01.259409','2026-06-11 20:16:01.259409','MenuManagement.deleteOperation',2),(90,'添加菜单配置','','','2026-06-11 20:16:46.511066','2026-06-11 20:16:46.511066','MenuSetting.add',108),(91,'修改菜单配置','','','2026-06-11 20:16:56.026079','2026-06-11 20:16:56.026079','MenuSetting.update',108),(92,'删除菜单配置','','','2026-06-11 20:17:03.891713','2026-06-11 20:17:03.891713','MenuSetting.delete',108);
/*!40000 ALTER TABLE `operation_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_list`
--

DROP TABLE IF EXISTS `role_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_list` (
  `role_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '角色id',
  `role_name` varchar(30) NOT NULL COMMENT '角色名称',
  `role_unit` varchar(30) DEFAULT NULL COMMENT '角色归属单位',
  `role_desc` text COMMENT '角色描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `role_dept` varchar(30) DEFAULT NULL COMMENT '角色归属部门',
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `IDX_01acc70e3261dbb56f5b38c774` (`role_name`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_list`
--

LOCK TABLES `role_list` WRITE;
/*!40000 ALTER TABLE `role_list` DISABLE KEYS */;
INSERT INTO `role_list` VALUES (1,'管理员','Kevin Mao','管理员','2026-01-07 11:52:55','2026-08-13 14:36:19',NULL),(16,'观赏','','','2026-06-26 17:25:27','2026-06-26 17:25:27','');
/*!40000 ALTER TABLE `role_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_menu`
--

DROP TABLE IF EXISTS `role_menu`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_menu` (
  `role_auth_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '角色可操作菜单ID',
  `role_id` int(11) NOT NULL COMMENT '角色Id',
  `menu_id` int(11) NOT NULL COMMENT '菜单Id',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `menu_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_auth_id`)
) ENGINE=InnoDB AUTO_INCREMENT=435 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_menu`
--

LOCK TABLES `role_menu` WRITE;
/*!40000 ALTER TABLE `role_menu` DISABLE KEYS */;
INSERT INTO `role_menu` VALUES (169,1,16,'2026-04-28 15:16:52','2026-04-28 15:16:52',NULL),(170,1,2,'2026-04-28 15:16:52','2026-04-28 15:16:52',NULL),(171,1,1,'2026-04-28 15:26:38','2026-04-28 15:26:38',NULL),(172,1,17,'2026-04-28 15:26:38','2026-04-28 15:26:38',NULL),(323,1,96,'2026-05-06 13:44:21','2026-05-06 13:44:21',NULL),(343,1,108,'2026-05-27 17:48:29','2026-05-27 17:48:29',NULL),(353,16,1,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(354,16,96,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(355,16,17,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(356,16,16,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(357,16,2,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(358,16,108,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(359,16,6,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(360,16,7,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(361,16,109,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(362,16,43,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(363,16,44,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(364,16,115,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(365,16,18,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(366,16,22,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(367,16,117,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(368,16,19,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(369,16,110,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(370,16,111,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(371,16,112,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(372,16,20,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(373,16,101,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(374,16,102,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(375,16,103,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(376,16,36,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(377,16,56,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(378,16,57,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(379,16,92,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(380,16,68,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(381,16,69,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(382,16,91,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(383,16,59,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(384,16,61,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(385,16,60,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(386,16,62,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(387,16,66,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(388,16,89,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(389,16,90,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(390,16,93,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(391,16,104,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(392,16,105,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(393,16,106,'2026-06-26 17:28:24','2026-06-26 17:28:24',NULL),(431,1,121,'2026-07-31 12:52:05','2026-07-31 12:52:05',NULL),(432,1,123,'2026-07-31 12:52:05','2026-07-31 12:52:05',NULL),(433,1,122,'2026-07-31 12:52:05','2026-07-31 12:52:05',NULL),(434,1,124,'2026-07-31 12:52:05','2026-07-31 12:52:05',NULL);
/*!40000 ALTER TABLE `role_menu` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_operation`
--

DROP TABLE IF EXISTS `role_operation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `role_operation` (
  `role_auth_id` int(11) NOT NULL AUTO_INCREMENT,
  `role_id` int(11) NOT NULL,
  `operation_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `operation_code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`role_auth_id`)
) ENGINE=InnoDB AUTO_INCREMENT=241 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_operation`
--

LOCK TABLES `role_operation` WRITE;
/*!40000 ALTER TABLE `role_operation` DISABLE KEYS */;
INSERT INTO `role_operation` VALUES (17,1,4,'2026-04-28 15:16:52','2026-04-28 15:16:52','123'),(18,1,3,'2026-04-28 15:16:52','2026-04-28 15:16:52','1'),(19,1,5,'2026-04-28 15:46:49','2026-04-28 15:46:49','UserAdminPage.add'),(20,1,6,'2026-04-28 15:46:49','2026-04-28 15:46:49','MenuManagement.add'),(21,1,66,'2026-04-29 00:25:26','2026-04-29 00:25:26','EMP_MNG.add'),(22,1,62,'2026-04-29 00:25:27','2026-04-29 00:25:27','CUST_FILE.add'),(23,1,55,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_BAR.add'),(24,1,59,'2026-04-29 00:25:27','2026-04-29 00:25:27','SPEC_MNG.add'),(25,1,49,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_MNG.add'),(26,1,53,'2026-04-29 00:25:27','2026-04-29 00:25:27','UNIT_MNG.add'),(27,1,50,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_MNG.delete'),(28,1,54,'2026-04-29 00:25:27','2026-04-29 00:25:27','UNIT_MNG.delete'),(29,1,56,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_BAR.delete'),(30,1,61,'2026-04-29 00:25:27','2026-04-29 00:25:27','SPEC_MNG.update'),(31,1,51,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_MNG.update'),(32,1,57,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_BAR.update'),(33,1,58,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_BAR.'),(34,1,52,'2026-04-29 00:25:27','2026-04-29 00:25:27','PROD_MNG.detail'),(35,1,45,'2026-04-29 00:25:27','2026-04-29 00:25:27','SUP_FILE.add'),(36,1,46,'2026-04-29 00:25:27','2026-04-29 00:25:27','SUP_FILE.delete'),(37,1,47,'2026-04-29 00:25:27','2026-04-29 00:25:27','SUP_FILE.update'),(38,1,48,'2026-04-29 00:25:27','2026-04-29 00:25:27','SUP_FILE.detail'),(39,1,63,'2026-04-29 00:25:27','2026-04-29 00:25:27','CUST_FILE.delete'),(40,1,67,'2026-04-29 00:25:27','2026-04-29 00:25:27','EMP_MNG.delete'),(41,1,64,'2026-04-29 00:25:27','2026-04-29 00:25:27','CUST_FILE.update'),(42,1,68,'2026-04-29 00:25:27','2026-04-29 00:25:27','EMP_MNG.update'),(43,1,65,'2026-04-29 00:25:27','2026-04-29 00:25:27','CUST_FILE.detail'),(44,1,26,'2026-04-29 00:25:27','2026-04-29 00:25:27','sales order.add'),(45,1,30,'2026-04-29 00:25:27','2026-04-29 00:25:27','.add'),(46,1,27,'2026-04-29 00:25:27','2026-04-29 00:25:27','sales order.delete'),(47,1,31,'2026-04-29 00:25:27','2026-04-29 00:25:27','.delete'),(48,1,28,'2026-04-29 00:25:27','2026-04-29 00:25:27','sales order.update'),(49,1,32,'2026-04-29 00:25:27','2026-04-29 00:25:27','.update'),(50,1,29,'2026-04-29 00:25:27','2026-04-29 00:25:27','sales order.detail'),(87,1,72,'2026-05-27 14:29:16','2026-05-27 14:29:16','DataImport.clearHistory'),(93,1,73,'2026-05-27 14:53:25','2026-05-27 14:53:25','DataImport.getImportHistoryList'),(96,1,74,'2026-06-11 22:18:49','2026-06-11 22:18:49','DataImport.clearImportHistory'),(97,1,75,'2026-06-11 22:18:49','2026-06-11 22:18:49','DataImport.importExcel'),(98,1,77,'2026-06-11 22:18:49','2026-06-11 22:18:49','DataImport.batchImportExcel'),(99,1,78,'2026-06-11 22:18:49','2026-06-11 22:18:49','AuthAdminPage.add'),(100,1,79,'2026-06-11 22:18:49','2026-06-11 22:18:49','AuthAdminPage.update'),(101,1,80,'2026-06-11 22:18:49','2026-06-11 22:18:49','AuthAdminPage.setAuth'),(102,1,81,'2026-06-11 22:18:49','2026-06-11 22:18:49','AuthAdminPage.delete'),(103,1,82,'2026-06-11 22:18:49','2026-06-11 22:18:49','UserAdminPage.add'),(104,1,83,'2026-06-11 22:18:50','2026-06-11 22:18:50','UserAdminPage.update'),(105,1,84,'2026-06-11 22:18:50','2026-06-11 22:18:50','UserAdminPage.delete'),(106,1,85,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuManagement.add'),(107,1,86,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuManagement.update'),(108,1,87,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuManagement.delete'),(109,1,88,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuManagement.addOperation'),(110,1,89,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuManagement.deleteOperation'),(111,1,90,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuSetting.add'),(112,1,91,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuSetting.update'),(113,1,92,'2026-06-11 22:18:50','2026-06-11 22:18:50','MenuSetting.delete'),(114,1,93,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.add'),(115,1,94,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.update'),(116,1,95,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.delete'),(117,1,96,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.print'),(118,1,97,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.outbound'),(119,1,99,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.batchOutbound'),(120,1,100,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.dataBind'),(121,1,110,'2026-06-11 22:18:50','2026-06-11 22:18:50','MarketOrder.cancelOutbound'),(122,1,101,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.add'),(123,1,102,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.update'),(124,1,103,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.delete'),(125,1,104,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.print'),(126,1,105,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.dataBind'),(127,1,107,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.batchInStock'),(128,1,108,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.inStock'),(129,1,111,'2026-06-11 22:18:50','2026-06-11 22:18:50','PurchaseOrder.cancelInStock'),(130,1,112,'2026-06-11 22:18:50','2026-06-11 22:18:50','InventoryVerification.update'),(131,1,113,'2026-06-11 22:18:50','2026-06-11 22:18:50','InventoryVerification.ImportCommodity'),(132,1,114,'2026-06-11 22:18:50','2026-06-11 22:18:50','OutboundVerification.add'),(133,1,115,'2026-06-11 22:18:50','2026-06-11 22:18:50','OutboundVerification.update'),(134,1,116,'2026-06-11 22:18:50','2026-06-11 22:18:50','OutboundVerification.delete'),(135,1,117,'2026-06-11 22:18:50','2026-06-11 22:18:50','StockVerification.add'),(136,1,118,'2026-06-11 22:18:50','2026-06-11 22:18:50','StockVerification.update'),(137,1,119,'2026-06-11 22:18:50','2026-06-11 22:18:50','StockVerification.delete'),(138,1,120,'2026-06-11 22:18:51','2026-06-11 22:18:51','AccountDueOrder.update'),(139,1,121,'2026-06-11 22:18:51','2026-06-11 22:18:51','AccountPayableManagement.update'),(140,1,125,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierGroup.add'),(141,1,126,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierGroup.update'),(142,1,127,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierGroup.delete'),(143,1,122,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierRecord.add'),(144,1,123,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierRecord.update'),(145,1,124,'2026-06-11 22:18:51','2026-06-11 22:18:51','SupplierRecord.delete'),(146,1,128,'2026-06-11 22:18:51','2026-06-11 22:18:51','ClientRecord.add'),(147,1,129,'2026-06-11 22:18:51','2026-06-11 22:18:51','ClientRecord.update'),(148,1,130,'2026-06-11 22:18:51','2026-06-11 22:18:51','ClientRecord.delete'),(149,1,131,'2026-06-11 22:18:51','2026-06-11 22:18:51','CustomerGroup.add'),(150,1,132,'2026-06-11 22:18:51','2026-06-11 22:18:51','CustomerGroup.update'),(151,1,133,'2026-06-11 22:18:51','2026-06-11 22:18:51','CustomerGroup.delete'),(152,1,134,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityManagement.add'),(153,1,135,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityManagement.update'),(154,1,136,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityManagement.delete'),(155,1,137,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityType.add'),(156,1,138,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityType.update'),(157,1,139,'2026-06-11 22:18:51','2026-06-11 22:18:51','CommodityType.delete'),(158,1,140,'2026-06-11 22:18:51','2026-06-11 22:18:51','UnitManagement.add'),(159,1,141,'2026-06-11 22:18:51','2026-06-11 22:18:51','UnitManagement.delete'),(160,1,142,'2026-06-11 22:18:51','2026-06-11 22:18:51','UnitManagement.update'),(161,1,143,'2026-06-11 22:18:51','2026-06-11 22:18:51','SpecManagement.add'),(162,1,144,'2026-06-11 22:18:51','2026-06-11 22:18:51','SpecManagement.update'),(163,1,145,'2026-06-11 22:18:51','2026-06-11 22:18:51','SpecManagement.delete'),(164,1,146,'2026-06-11 22:18:51','2026-06-11 22:18:51','StaffManagement.add'),(165,1,147,'2026-06-11 22:18:51','2026-06-11 22:18:51','StaffManagement.update'),(166,1,148,'2026-06-11 22:18:51','2026-06-11 22:18:51','StaffManagement.delete'),(167,1,149,'2026-06-11 22:18:51','2026-06-11 22:18:51','StaffManagement.dimission'),(168,1,150,'2026-06-11 22:18:51','2026-06-11 22:18:51','DepartmentManagement.add'),(169,1,151,'2026-06-11 22:18:51','2026-06-11 22:18:51','DepartmentManagement.update'),(170,1,152,'2026-06-11 22:18:51','2026-06-11 22:18:51','DepartmentManagement.delete'),(171,1,153,'2026-06-11 22:18:51','2026-06-11 22:18:51','PrintSetting.add'),(172,1,154,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintSetting.update'),(173,1,155,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintSetting.setting'),(174,1,156,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintSetting.delete'),(175,1,157,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintReceipt.add'),(176,1,158,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintReceipt.update'),(177,1,159,'2026-06-11 22:18:52','2026-06-11 22:18:52','PrintReceipt.delete'),(178,1,160,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountDueOrder.batchInvoice'),(179,1,163,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountPayableManagement.batchInvoice'),(180,1,161,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountDueOrder.exportClientReconiliationInfo'),(181,1,164,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountPayableManagement.exportSupplierReconiliationInfo'),(182,1,162,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountDueOrder.confirmPayment'),(183,1,165,'2026-06-17 17:35:57','2026-06-17 17:35:57','AccountPayableManagement.confirmPayment');
/*!40000 ALTER TABLE `role_operation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_list`
--

DROP TABLE IF EXISTS `user_list`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `user_list` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT COMMENT '用户id',
  `password` varchar(255) NOT NULL DEFAULT '' COMMENT '密码',
  `username` varchar(30) DEFAULT NULL COMMENT '真实姓名',
  `email` varchar(255) DEFAULT NULL COMMENT '邮箱',
  `phone_number` varchar(11) DEFAULT NULL COMMENT '手机号',
  `role_id` int(11) DEFAULT NULL COMMENT '权限等级',
  `role_name` varchar(30) DEFAULT NULL COMMENT '权限名称',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `account` varchar(30) NOT NULL COMMENT '账户',
  `gender` tinyint(4) DEFAULT '0' COMMENT '性别',
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `IDX_5681c0b684b1031c3083ec1401` (`account`)
) ENGINE=InnoDB AUTO_INCREMENT=28 DEFAULT CHARSET=utf8mb4;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_list`
--

LOCK TABLES `user_list` WRITE;
/*!40000 ALTER TABLE `user_list` DISABLE KEYS */;
INSERT INTO `user_list` VALUES (5,'$2b$10$5ZBoxPK5r248MoFkddV4ze/Xig/mzPmMKWvjeO06tPi4rpapW2KcG','管理员','2153870090@qq.com',NULL,1,'管理员','2026-04-22 21:11:28','2026-08-13 14:36:37','admin',1);
/*!40000 ALTER TABLE `user_list` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'etp_default_sql'
--

--
-- Dumping routines for database 'etp_default_sql'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-13 14:37:00
