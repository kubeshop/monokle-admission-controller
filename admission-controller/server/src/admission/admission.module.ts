import { Module } from "@nestjs/common";
import {AdmissionController} from "./admission.controller";

@Module({
    imports: [],
    controllers: [AdmissionController],
    providers: [],
})
export class AdmissionModule {}
