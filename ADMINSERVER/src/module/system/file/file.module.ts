import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from 'src/entities/system/file/file.entity';
import { FilesService } from 'src/services/system/file/file.service';
import { FilesController } from 'src/controller/system/file/file.controller';

@Module({
    imports: [TypeOrmModule.forFeature([FileEntity], 'etp_default_sql')],
    controllers: [FilesController],
    providers: [FilesService],
})
export class FileModule {}