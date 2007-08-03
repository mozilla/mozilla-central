-- MySQL dump 10.9
--
-- Host: localhost    Database: o_graphs
-- ------------------------------------------------------
-- Server version	4.1.20

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `annotations`
--

DROP TABLE IF EXISTS `annotations`;
CREATE TABLE `annotations` (
  `dataset_id` int(11) default NULL,
  `time` int(11) default NULL,
  `value` varchar(255) default NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Table structure for table `dataset_branchinfo`
--

DROP TABLE IF EXISTS `dataset_branchinfo`;
CREATE TABLE `dataset_branchinfo` (
  `dataset_id` int(11) default NULL,
  `time` int(11) default NULL,
  `branchid` varchar(255) default NULL,
  KEY `datasets_branchinfo_id_idx` (`dataset_id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Table structure for table `dataset_extra_data`
--

DROP TABLE IF EXISTS `dataset_extra_data`;
CREATE TABLE `dataset_extra_data` (
  `dataset_id` int(11) default NULL,
  `time` int(11) default NULL,
  `data` varchar(255) default NULL,
  KEY `datasets_extradata_id_idx` (`dataset_id`),
  KEY `datasets_extra_data_supplemental_idx` (`dataset_id`,`time`,`data`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Table structure for table `dataset_info`
--

DROP TABLE IF EXISTS `dataset_info`;
CREATE TABLE `dataset_info` (
  `id` int(11) NOT NULL auto_increment,
  `type` varchar(255) default NULL,
  `machine` varchar(255) default NULL,
  `test` varchar(255) default NULL,
  `test_type` varchar(255) default NULL,
  `extra_data` varchar(255) default NULL,
  `branch` varchar(255) default NULL,
  `date` int(11) default NULL,
  PRIMARY KEY  (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

--
-- Table structure for table `dataset_values`
--

DROP TABLE IF EXISTS `dataset_values`;
CREATE TABLE `dataset_values` (
  `dataset_id` int(11) default NULL,
  `time` int(11) default NULL,
  `value` float default NULL,
  KEY `datasets_id_idx` (`dataset_id`),
  KEY `datasets_time_idx` (`time`),
  KEY `datasets_time_id_idx` (`dataset_id`,`time`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

