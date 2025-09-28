import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
        selector: 'app-loader',
        standalone: true,
        templateUrl: './loader.component.html',
        styleUrls: ['./loader.component.scss'],
        changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoaderComponent {
    @Input() size: number | string = 108; // px
    @Input() overlay = false;
}