import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import { LoaderComponent } from '../loader/loader.component';
import { LOCALE_ID } from '@angular/core';

@Component({
    selector: 'app-form',
    standalone: true,
    imports: [
        CommonModule, 
        ReactiveFormsModule, 
        MatSelectModule, 
        MatFormFieldModule, 
        MatInputModule, 
        MatDatepickerModule, 
        MatNativeDateModule, 
        MatButtonModule,
        LoaderComponent
    ],
    providers: [
        { provide: MAT_DATE_LOCALE, useValue: 'pt-BR' },
        { provide: LOCALE_ID, useValue: 'pt-BR' }
    ],
    templateUrl: './customForm.component.html',
    styleUrls: ['./customForm.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomFormComponent implements OnInit {
    @Input() formGroup!: FormGroup;
    @Output() formSubmit = new EventEmitter<any>();

    planilhasPsicologos: Array<{ nome: string; url: string }> = [];
    horariosCarregando = signal(false);
    loadingSubmit = signal(false);
    horariosDisponiveis: string[] = [];
    minDateString: string;
    minDate: Date;
    scriptURL = '';

    constructor(private http: HttpClient, private toastr: ToastrService) {
        const today = new Date();
        this.minDateString = today.toISOString().split('T')[0];
        this.minDate = new Date();
    }

    ngOnInit(): void {
        this.carregarPsicologos();
        this.setupFormListeners();
    }

    private setupFormListeners() {
        this.formGroup.get('psicologo')?.valueChanges.subscribe((value) => {
            const profissionalSelecionado = this.planilhasPsicologos.find((x) => x.nome === value);
            if (profissionalSelecionado) {
                this.scriptURL = profissionalSelecionado.url;
                const dataSelecionada = this.formGroup.get('data')?.value;
                if (dataSelecionada) {
                    this.habilitarHora(true);
                    this.obterHorarios(this.scriptURL, dataSelecionada);
                }
            } else {
                this.scriptURL = '';
                this.habilitarHora(false);
            }
        });

        this.formGroup.get('data')?.valueChanges.subscribe((dataSelecionada) => {
            const psicologoSelecionado = this.formGroup.get('psicologo')?.value;
            if (psicologoSelecionado && dataSelecionada && this.scriptURL) {
                this.habilitarHora(true);
                this.obterHorarios(this.scriptURL, dataSelecionada);
            } else {
                this.habilitarHora(false);
            }
        });
    }

    private carregarPsicologos() {
        const url = 'https://script.google.com/macros/s/AKfycbwDM7wIH0c3FOzgw6Y-9MxVI7alohX_sw2MIg62OfVGcCdA9k_rvsojZefj7YD3Z_jB/exec';
        this.http.get<Array<{ nome: string; url: string }>>(url).subscribe({
            next: (data) => {
                this.planilhasPsicologos = data ?? [];
                this.formGroup.get('psicologo')?.enable({ emitEvent: false });
            },
            error: (err) => {
                console.error('Erro ao carregar os dados:', err);
                this.showToastr('Erro ao carregar os profissionais.', 'error');
            },
        });
    }

    private habilitarHora(enable: boolean) {
        const horaCtrl = this.formGroup.get('hora');
        if (!horaCtrl) return;
        if (enable) {
            horaCtrl.enable({ emitEvent: false });
        } else {
            horaCtrl.disable({ emitEvent: false });
            horaCtrl.reset('');
            this.horariosDisponiveis = [];
        }
    }

    private gerarHorariosDisponiveis(): string[] {
        const horarios: string[] = [];
        for (let h = 8; h <= 18; h++) {
            const horaFormatada = h.toString().padStart(2, '0') + ':00';
            horarios.push(horaFormatada);
        }
        return horarios;
    }

    private converterDataParaISO(data: string) {
        const [dia, mes, ano] = data.split('/');
        return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }

    private obterHorarios(scriptURL: string, dataSelecionada: string) {
        this.horariosCarregando.set(true);
        this.horariosDisponiveis = [];
        
        this.http.get<{ horarios: Array<{ data: string; hora: string }> }>(scriptURL).subscribe({
            next: (data) => {
                const horariosOcupados = (data?.horarios || [])
                    .filter((h) => this.converterDataParaISO(h.data) === dataSelecionada)
                    .map((h) => h.hora);

                const todos = this.gerarHorariosDisponiveis();
                const disponiveis = todos.filter((h) => !horariosOcupados.includes(h));
                this.horariosDisponiveis = disponiveis;
                this.horariosCarregando.set(false);
                
                if (!disponiveis.includes(this.formGroup.get('hora')?.value || '')) {
                    this.formGroup.get('hora')?.setValue('');
                }
            },
            error: (err) => {
                console.error('Erro ao obter os horários:', err);
                this.showToastr('Erro ao carregar os horários.', 'error');
                this.horariosCarregando.set(false);
            },
        });
    }

    private showToastr(message: string, type: 'success' | 'error' | 'warning') {
        switch (type) {
            case 'success':
                this.toastr.success(message, 'Sucesso!');
                break;
            case 'error':
                this.toastr.error(message, 'Erro!');
                break;
            case 'warning':
                this.toastr.warning(message, 'Atenção!');
                break;
        }
    }

    onSubmit() {
        if (this.formGroup.invalid) {
            this.showToastr('Por favor, preencha todos os campos obrigatórios.', 'warning');
            return;
        }

        if (!this.scriptURL) {
            this.showToastr('Por favor, selecione um psicólogo.', 'warning');
            return;
        }

        this.loadingSubmit.set(true);
        this.submitForm();
    }

    private submitForm() {
        const mainURL = 'https://script.google.com/macros/s/AKfycbzEDOu7dFI2mE79PeniKjgyoQjx0A9l7iNU5CdNjf6HC1yvcCo7XKVFlKISnB89C2ntTQ/exec';
        
        const nome = this.capitalizeFirstLetter(this.formGroup.value.nome || '');
        const psicologo = this.capitalizeFirstLetter(this.formGroup.value.psicologo || '');
        const email = (this.formGroup.value.email || '').trim();
        const data = this.formGroup.value.data;
        const hora = this.formGroup.value.hora || '';

        const fd = new FormData();
        fd.set('Nome', nome);
        fd.set('Psicólogo', psicologo);
        fd.set('Email', email);
        fd.set('Data', data);
        fd.set('Hora', hora);

        this.http.post<any>(mainURL, fd).subscribe({
            next: (result) => {
                if (result?.result === 'success') {
                    this.showToastr('Obrigado, seu cadastro foi adicionado com sucesso! Fique de olho na data!', 'success');

                    if (this.scriptURL) {
                        this.http.post<any>(this.scriptURL, fd).subscribe({
                            next: (res) => {
                                console.log('Enviado para planilha individual:', res);
                            },
                            error: (e) => {
                                console.error('Erro ao enviar para a planilha individual:', e);
                                this.showToastr('Erro ao enviar para a planilha individual.', 'error');
                            },
                        });
                    }

                    this.resetForm();
                } else if (result?.result === 'error' && result?.message === 'agendamento duplicado') {
                    this.showToastr('Este agendamento já foi feito. Por favor, selecione outro horário.', 'warning');
                } else {
                    this.showToastr('Erro: ' + (result?.message ?? 'desconhecido'), 'error');
                }
            },
            error: (error) => {
                console.error('Erro no envio:', error);
                this.showToastr('Houve um erro ao enviar os dados. Tente novamente mais tarde.', 'error');
            },
            complete: () => {
                this.loadingSubmit.set(false);
            },
        });
    }

    private capitalizeFirstLetter(str: string) {
        return (str || '')
            .toLowerCase()
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    resetForm() {
        this.formGroup.reset();
        this.horariosDisponiveis = [];
        this.scriptURL = '';
        this.formGroup.get('psicologo')?.enable({ emitEvent: false });
        this.habilitarHora(false);
    }
}
