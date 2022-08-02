// Copyright (C) 2022 Intel Corporation
//
// SPDX-License-Identifier: MIT

import { fabric } from 'fabric';

import {
    Configuration, DrawData, MasksEditData, Geometry,
} from './canvasModel';
import consts from './consts';
import { PropType } from './shared';

export interface MasksHandler {
    configurate(configuration: Configuration): void;
    draw(drawData: DrawData): void;
    edit(state: MasksEditData): void;
    transform(geometry: Geometry): void;
    setupStates(objectStates: any[]): void;
    cancel(): void;
    enabled: boolean;
}

export class MasksHandlerImpl implements MasksHandler {
    private onDrawDone: (
        data: object | null,
        duration?: number,
        continueDraw?: boolean,
        prevDrawData?: DrawData,
    ) => void;
    private onContinueDraw: (data: DrawData) => void;
    private onEditStart: (state: any) => void;
    private onEditDone: (state: any, points: number[]) => void;
    private dispatchEvent: (event: Event) => void;

    private isDrawing: boolean;
    private isEditing: boolean;
    private isPolygonDrawing: boolean;
    private isMaskDrawing: boolean;
    private isMouseDown: boolean;
    private drawablePolygon: null | fabric.Polyline;
    private drawData: DrawData | null;
    private editData: MasksEditData | null;
    private canvas: fabric.Canvas;
    private objectStates: any[];
    private startTimestamp: number;
    private geometry: Geometry;
    private drawnObjects: (fabric.Path | fabric.Polygon | fabric.Circle | fabric.Rect | fabric.Line)[];
    private drawingOpacity: number;

    private keepDrawnPolygon(): void {
        // TODO: check if polygon has at least three different points
        this.drawablePolygon.stroke = undefined;
        if (this.drawData.brushTool?.type === 'polygon-minus') {
            this.drawablePolygon.globalCompositeOperation = 'destination-out';
            this.drawablePolygon.opacity = 1;
        } else {
            this.drawablePolygon.globalCompositeOperation = 'xor';
            this.drawablePolygon.opacity = 0.5;
            this.drawnObjects.push(this.drawablePolygon);
        }

        this.drawablePolygon = null;
        this.canvas.renderAll();
    }

    private releaseDraw(): void {
        this.canvas.clear();
        this.canvas.renderAll();
        this.canvas.getElement().parentElement.style.display = '';
        this.isDrawing = false;
        this.isPolygonDrawing = false;
        this.drawnObjects = [];
        this.onDrawDone(null);
        if (this.drawablePolygon) {
            this.drawablePolygon = null;
        }
    }

    private releaseEdit(): void {
        this.canvas.clear();
        this.canvas.renderAll();
        this.canvas.getElement().parentElement.style.display = '';
        this.isEditing = false;
        this.drawnObjects = [];
        this.onEditDone(null, null);
    }

    public constructor(
        onDrawDone: (
            data: object | null,
            duration?: number,
            continueDraw?: boolean,
            prevDrawData?: DrawData,
        ) => void,
        onContinueDraw: (data: DrawData) => void,
        dispatchEvent: (event: Event) => void,
        onEditStart: (state: any) => void,
        onEditDone: (state: any, points: number[]) => void,
        canvas: HTMLCanvasElement,
    ) {
        this.isDrawing = false;
        this.isEditing = false;
        this.drawData = null;
        this.editData = null;
        this.drawnObjects = [];
        this.objectStates = [];
        this.drawingOpacity = 0.5;
        this.onDrawDone = onDrawDone;
        this.onContinueDraw = onContinueDraw;
        this.onEditDone = onEditDone;
        this.onEditStart = onEditStart;
        this.dispatchEvent = dispatchEvent;
        this.canvas = new fabric.Canvas(canvas, { containerClass: 'cvat_masks_canvas_wrapper', fireRightClick: true, selection: false });
        this.canvas.imageSmoothingEnabled = false;
        this.canvas.on('path:created', (opt) => {
            if (this.drawData.brushTool?.type === 'eraser') {
                (opt as any).path.globalCompositeOperation = 'destination-out';
            } else {
                (opt as any).path.globalCompositeOperation = 'xor';
            }

            let color = new fabric.Color(this.drawData.brushTool?.color || 'white');
            color.setAlpha(0.5);
            if (this.drawData.brushTool.type === 'eraser') {
                color = fabric.Color.fromHex('#ffffff');
                color.setAlpha(1);
            }
            (opt as any).path.stroke = color.toRgba();
            this.drawnObjects.push((opt as any).path);
        });

        this.canvas.getElement().parentElement.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

        let prevMovePosition : { x: number | null; y: number | null } = {
            x: null,
            y: null,
        };
        window.document.addEventListener('mouseup', () => {
            // todo: clear the callback when element is removed
            this.isMouseDown = false;
            prevMovePosition.x = null;
            prevMovePosition.y = null;
        });

        this.canvas.on('mouse:dblclick', (options: fabric.IEvent<MouseEvent>) => {
            if (!this.drawablePolygon) return;
            const points = this.drawablePolygon.get('points').slice(0, -2); // removed the latest two points just added
            this.drawablePolygon.set('points', points);
            this.keepDrawnPolygon();
            options.e.stopPropagation();
        });

        this.canvas.on('mouse:down', (options: fabric.IEvent<MouseEvent>) => {
            this.isMouseDown = true;
            if (this.isPolygonDrawing) {
                const point = new fabric.Point(options.e.offsetX, options.e.offsetY);
                if (!this.drawablePolygon) {
                    // polygon not created yet, first click
                    this.drawablePolygon = new fabric.Polygon([point, fabric.util.object.clone(point)], {
                        opacity: this.drawingOpacity,
                        strokeWidth: consts.BASE_STROKE_WIDTH / this.geometry.scale,
                        stroke: 'black',
                        fill: this.drawData.brushTool.type === 'polygon-minus' ? 'white' : (this.drawData.brushTool?.color || 'white'),
                        selectable: false,
                        objectCaching: false,
                        absolutePositioned: true,
                    });
                    this.canvas.add(this.drawablePolygon);
                } if (options.e.button === 2) {
                    // remove the latest button
                    const points = this.drawablePolygon.get('points');
                    if (points.length > 2) { // at least three points including sliding point
                        points.splice(points.length - 2, 1);
                        this.drawablePolygon.set('points', [...points]);
                    } else {
                        this.canvas.remove(this.drawablePolygon);
                        this.drawablePolygon = null;
                    }
                } else {
                    // remove sliding point, add one point, add new sliding point
                    this.drawablePolygon.set('points', [
                        ...this.drawablePolygon.get('points').slice(0, -1),
                        point,
                        fabric.util.object.clone(point),
                    ]);
                }
                this.canvas.renderAll();
            } else if (this.isMaskDrawing) {
                // remember mousedown
            }
        });

        this.canvas.on('mouse:move', (e: fabric.IEvent<MouseEvent>) => {
            const position = { x: e.pointer.x, y: e.pointer.y };
            console.log(position);
            if (this.drawablePolygon) {
                const points = this.drawablePolygon.get('points');
                if (points.length) {
                    points[points.length - 1].setX(e.e.offsetX);
                    points[points.length - 1].setY(e.e.offsetY);
                    this.canvas.renderAll();
                }
            } else if (this.isMaskDrawing && this.isMouseDown) {
                const brush = this.drawData.brushTool;
                let color = fabric.Color.fromHex(brush.color);
                if (brush.type === 'eraser') {
                    color = fabric.Color.fromHex('#ffffff');
                }
                color.setAlpha(0.5);
                if (brush.type === 'eraser') {
                    color = fabric.Color.fromHex('#ffffff');
                    color.setAlpha(1);
                }

                if (brush.form === 'circle') {
                    const circle = new fabric.Circle({
                        selectable: false,
                        evented: false,
                        radius: brush.size / 2,
                        fill: color.toRgba(),
                        left: position.x - brush.size / 2,
                        top: position.y - brush.size / 2,
                    });

                    if (this.drawData.brushTool?.type === 'eraser') {
                        circle.globalCompositeOperation = 'destination-out';
                    } else {
                        circle.globalCompositeOperation = 'xor';
                    }

                    this.canvas.add(circle);
                    this.drawnObjects.push(circle);
                } else if (brush.form === 'square') {
                    const rect = new fabric.Rect({
                        selectable: false,
                        evented: false,
                        width: brush.size,
                        height: brush.size,
                        fill: color.toRgba(),
                        left: position.x - brush.size / 2,
                        top: position.y - brush.size / 2,
                    });

                    if (brush.type === 'eraser') {
                        rect.globalCompositeOperation = 'destination-out';
                    } else {
                        rect.globalCompositeOperation = 'xor';
                    }

                    this.canvas.add(rect);
                    this.drawnObjects.push(rect);
                }

                if (prevMovePosition.x !== null && prevMovePosition.y !== null) {
                    const dx = position.x - prevMovePosition.x;
                    const dy = position.y - prevMovePosition.y;
                    if (Math.sqrt(dx ** 2 + dy ** 2) > this.drawData.brushTool?.size / 2) {
                        const line = new fabric.Line([
                            prevMovePosition.x - brush.size / 2,
                            prevMovePosition.y - brush.size / 2,
                            position.x - brush.size / 2,
                            position.y - brush.size / 2,
                        ], {
                            stroke: color.toRgba(),
                            strokeWidth: brush.size,
                            selectable: false,
                            evented: false,
                        });

                        if (brush.type === 'eraser') {
                            line.globalCompositeOperation = 'destination-out';
                        } else {
                            line.globalCompositeOperation = 'xor';
                        }

                        line.strokeLineCap = brush.form === 'circle' ? 'round' : 'square';


                        this.canvas.add(line);
                        this.drawnObjects.push(line);
                    }
                }

                prevMovePosition.x = position.x;
                prevMovePosition.y = position.y;
                this.canvas.renderAll();
            }
        });
    }

    public transform(geometry: Geometry): void {
        this.geometry = geometry;
        const {
            image: { width, height }, scale, angle, top, left,
        } = geometry;

        const topCanvas = this.canvas.getElement().parentElement as HTMLDivElement;
        this.canvas.setHeight(height);
        this.canvas.setWidth(width);
        this.canvas.setDimensions({ width, height });
        topCanvas.style.top = `${top}px`;
        topCanvas.style.left = `${left}px`;
        topCanvas.style.transform = `scale(${scale}) rotate(${angle}deg)`;

        if (this.drawablePolygon) {
            this.drawablePolygon.set('strokeWidth', consts.BASE_STROKE_WIDTH / scale);
            this.canvas.renderAll();
        }
    }

    public configurate(configuration: Configuration): void {
        if (typeof configuration.creationOpacity === 'number') {
            this.drawingOpacity = Math.max(0, Math.min(1, configuration.creationOpacity));

            if (this.drawablePolygon) {
                this.drawablePolygon.set('opacity', this.drawingOpacity);
                this.canvas.renderAll();
            }

            if (this.canvas.freeDrawingBrush?.color) {
                const color = fabric.Color.fromRgba(this.canvas.freeDrawingBrush.color);
                color.setAlpha(this.drawingOpacity);
                this.canvas.freeDrawingBrush.color = color.toRgba();
            }
        }
    }

    public draw(drawData: DrawData): void {
        if (drawData.enabled && drawData.shapeType === 'mask') {
            if (drawData.brushTool?.type === 'brush') {
                this.isMaskDrawing = true;
            }
            if (!this.isDrawing) {
                // initialize new drawing process
                this.canvas.getElement().parentElement.style.display = 'block';
                this.isDrawing = true;
                this.startTimestamp = Date.now();
            } else if (['polygon-plus', 'polygon-minus'].includes(drawData.brushTool?.type)) {
                if (!this.isPolygonDrawing) {
                    this.isPolygonDrawing = true;
                    this.isMaskDrawing = false;
                }
            } else if (this.isPolygonDrawing && this.drawablePolygon) {
                this.keepDrawnPolygon();
                this.isPolygonDrawing = false;
            }

            // if (drawData.brushTool) {
            //     this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
            //     this.canvas.freeDrawingBrush.width = drawData.brushTool.size || 10;
            //     this.canvas.freeDrawingBrush.strokeLineCap = drawData.brushTool.form === 'circle' ? 'round' : 'square';
            //     let color = fabric.Color.fromHex(drawData.brushTool.color);
            //     if (drawData.brushTool.type === 'eraser') {
            //         color = fabric.Color.fromHex('#ffffff');
            //     }
            //     color.setAlpha(this.drawingOpacity);
            //     this.canvas.freeDrawingBrush.color = color.toRgba();
            // }
            this.drawData = drawData;
        } else if (this.isDrawing) {
            // todo: make a smarter validation
            if (this.drawnObjects.length) {
                type BoundingRect = ReturnType<PropType<fabric.Polygon, 'getBoundingRect'>>;
                type TwoCornerBox = Pick<BoundingRect, 'top' | 'left'> & { right: number; bottom: number };
                const { width, height } = this.geometry.image;
                const wrappingBbox = this.drawnObjects
                    .map((element: fabric.Path | fabric.Polygon) => element.getBoundingRect())
                    .reduce((acc: TwoCornerBox, rect: BoundingRect) => {
                        acc.top = Math.floor(Math.max(0, Math.min(rect.top, acc.top)));
                        acc.left = Math.floor(Math.max(0, Math.min(rect.left, acc.left)));
                        acc.bottom = Math.floor(Math.min(height - 1, Math.max(rect.top + rect.height, acc.bottom)));
                        acc.right = Math.floor(Math.min(width - 1, Math.max(rect.left + rect.width, acc.right)));
                        return acc;
                    }, {
                        left: Number.MAX_SAFE_INTEGER,
                        top: Number.MAX_SAFE_INTEGER,
                        right: Number.MIN_SAFE_INTEGER,
                        bottom: Number.MIN_SAFE_INTEGER,
                    });

                const imageData = this.canvas.toCanvasElement()
                    .getContext('2d').getImageData(
                        wrappingBbox.left, wrappingBbox.top,
                        wrappingBbox.right - wrappingBbox.left + 1, wrappingBbox.bottom - wrappingBbox.top + 1,
                    ).data;

                let alpha = [];
                for (let i = 3; i < imageData.length; i += 4) {
                    alpha.push(imageData[i] > 0 ? 1 : 0);
                }

                // if (this.drawData.brushTool?.removeUnderlyingPixels) {
                //     for (const state of this.objectStates) {
                //         const [left, top, right, bottom] = state.points.slice(-4);
                //         const [stateWidth, stateHeight] = [Math.floor(right - left), Math.floor(bottom - top)];
                //         // todo: check box intersection to optimize
                //         const points = state.points.slice(0, -4);
                //         for (let i = 0; i < alpha.length - 4; i++) {
                //             if (!alpha[i]) continue;
                //             const x = (i % (wrappingBbox.right - wrappingBbox.left)) + wrappingBbox.left;
                //             const y = Math.trunc(i / (wrappingBbox.right - wrappingBbox.left)) + wrappingBbox.top;
                //             const translatedX = x - left;
                //             const translatedY = y - top;
                //             if (translatedX >= 0 && translatedX < stateWidth &&
                //                 translatedY >= 0 && translatedY < stateHeight) {
                //                 const j = translatedY * stateWidth + translatedX;
                //                 points[j] = 0;
                //             }
                //         }

                //         points.push(left, top, right, bottom);

                //         // todo: do not edit shapes here because it creates more history actions
                //         const event: CustomEvent = new CustomEvent('canvas.edited', {
                //             bubbles: false,
                //             cancelable: true,
                //             detail: {
                //                 state,
                //                 points,
                //                 rotation: 0,
                //             },
                //         });

                //         this.dispatchEvent(event);
                //     }
                // }

                alpha = alpha.reduce<number[]>((acc, val, idx, arr) => {
                    if (idx > 0) {
                        if (arr[idx - 1] === val) {
                            acc[acc.length - 1] += 1;
                        } else {
                            acc.push(1);
                        }

                        return acc;
                    }

                    if (val > 0) {
                        // 0, 0, 0, 1 => [3, 1]
                        // 1, 1, 0, 0 => [0, 2, 2]
                        acc.push(0, 1);
                    } else {
                        acc.push(1);
                    }

                    return acc;
                }, []);

                alpha.push(wrappingBbox.left, wrappingBbox.top, wrappingBbox.right, wrappingBbox.bottom);

                this.onDrawDone({
                    shapeType: this.drawData.shapeType,
                    points: alpha,
                }, Date.now() - this.startTimestamp, drawData.continue, this.drawData);
            }

            this.releaseDraw();
            if (drawData.continue) {
                this.onContinueDraw(this.drawData);
            } else {
                this.drawData = drawData;
            }
        }
    }

    public edit(editData: MasksEditData): void {
        // todo: disable some controls from brush toolbar
        // todo: during drawing add other parts using xor global operator

        if (editData.enabled && editData.state.shapeType === 'mask') {
            if (!this.isEditing) {
                this.isEditing = true;
                this.canvas.isDrawingMode = true;
                this.canvas.getElement().parentElement.style.display = 'block';
                this.onEditStart(editData.state);

                const color = fabric.Color.fromHex(editData.state.color).getSource();
                const { points } = editData.state;
                const [left, top, right, bottom] = points.slice(-4);
                const imageBitmap = [];
                for (let i = 0; i < points.length - 4; i++) {
                    const alpha = points[i];
                    imageBitmap.push(color[0], color[1], color[2], alpha * 255);
                }

                const canvas = document.createElement('canvas');
                canvas.width = right - left;
                canvas.height = bottom - top;
                canvas.getContext('2d').putImageData(
                    new ImageData(
                        new Uint8ClampedArray(imageBitmap),
                        right - left,
                        bottom - top,
                    ), 0, 0,
                );
                const dataURL = canvas.toDataURL('image/png');

                fabric.Image.fromURL(dataURL, (image: fabric.Image) => {
                    this.canvas.add(image);
                    this.canvas.renderAll();
                    URL.revokeObjectURL(dataURL);
                }, { left, top });
            } else if (['polygon-plus', 'polygon-minus'].includes(editData.brushTool?.type)) {
                if (!this.isPolygonDrawing) {
                    this.isPolygonDrawing = true;
                    this.canvas.isDrawingMode = false;
                }
            } else if (this.isPolygonDrawing && this.drawablePolygon) {
                this.keepDrawnPolygon();
                this.isPolygonDrawing = false;
            }

            if (editData.brushTool) {
                this.canvas.freeDrawingBrush = new fabric.PencilBrush(this.canvas);
                this.canvas.freeDrawingBrush.width = editData.brushTool.size || 10;
                this.canvas.freeDrawingBrush.strokeLineCap = editData.brushTool.form === 'circle' ? 'round' : 'square';
                let color = fabric.Color.fromHex(editData.brushTool.color);
                if (editData.brushTool.type === 'eraser') {
                    color = fabric.Color.fromHex('#ffffff');
                }
                color.setAlpha(this.drawingOpacity);
                this.canvas.freeDrawingBrush.color = color.toRgba();
            }
        } else if (!editData.enabled) {
            // todo: compute new shape
            const points = [];
            this.onEditDone(this.editData.state, points);
            this.releaseDraw();
        }
        this.editData = editData;
    }

    public setupStates(objectStates: any[]): void {
        this.objectStates = objectStates;
    }

    get enabled(): boolean {
        return this.isDrawing || this.isEditing;
    }

    public cancel(): void {
        if (this.isDrawing) {
            this.releaseDraw();
        }

        if (this.isEditing) {
            this.releaseEdit();
        }
    }
}
