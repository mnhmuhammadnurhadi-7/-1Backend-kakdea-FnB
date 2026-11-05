-- AlterTable: varian menjadi TEXT agar bisa menampung beberapa varian (dipisah koma)
ALTER TABLE `produk` MODIFY `varian` TEXT NULL;
