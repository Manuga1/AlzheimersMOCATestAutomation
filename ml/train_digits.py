"""Train a small CNN digit classifier (0-9) on MNIST and export to ONNX.

The exported model (public/models/digits.onnx) is used in-browser via
onnxruntime-web to recognize the handwritten clock-face numbers drawn with
the stylus. Input: 1x1x28x28 float32 (0=background, 1=ink, MNIST-style).
Output: logits over 10 classes.

Usage: python3 ml/train_digits.py [--epochs 3]
"""
import argparse
import os

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torchvision import datasets, transforms


class DigitNet(nn.Module):
    """LeNet-class CNN, ~100k params, <500KB as ONNX."""

    def __init__(self) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(1, 16, 3, padding=1)
        self.conv2 = nn.Conv2d(16, 32, 3, padding=1)
        self.conv3 = nn.Conv2d(32, 64, 3, padding=1)
        self.fc1 = nn.Linear(64 * 3 * 3, 128)
        self.fc2 = nn.Linear(128, 10)
        self.dropout = nn.Dropout(0.3)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.max_pool2d(F.relu(self.conv1(x)), 2)  # 14x14
        x = F.max_pool2d(F.relu(self.conv2(x)), 2)  # 7x7
        x = F.max_pool2d(F.relu(self.conv3(x)), 2)  # 3x3
        x = x.flatten(1)
        x = self.dropout(F.relu(self.fc1(x)))
        return self.fc2(x)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=128)
    args = parser.parse_args()

    torch.manual_seed(0)
    root = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(root, "data")

    # Random affine augmentation approximates the variability of elderly
    # handwriting (rotation, scale drift) better than clean MNIST alone.
    train_tf = transforms.Compose([
        transforms.RandomAffine(degrees=12, translate=(0.1, 0.1), scale=(0.8, 1.15)),
        transforms.ToTensor(),
    ])
    test_tf = transforms.ToTensor()

    train_ds = datasets.MNIST(data_dir, train=True, download=True, transform=train_tf)
    test_ds = datasets.MNIST(data_dir, train=False, download=True, transform=test_tf)
    train_dl = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=2)
    test_dl = DataLoader(test_ds, batch_size=512, num_workers=2)

    model = DigitNet()
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)

    for epoch in range(args.epochs):
        model.train()
        total_loss = 0.0
        for xb, yb in train_dl:
            opt.zero_grad()
            loss = F.cross_entropy(model(xb), yb)
            loss.backward()
            opt.step()
            total_loss += loss.item() * len(xb)

        model.eval()
        correct = 0
        with torch.no_grad():
            for xb, yb in test_dl:
                correct += (model(xb).argmax(1) == yb).sum().item()
        acc = correct / len(test_ds)
        print(f"epoch {epoch + 1}: loss={total_loss / len(train_ds):.4f} test_acc={acc:.4f}")

    out_dir = os.path.join(os.path.dirname(root), "public", "models")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "digits.onnx")
    model.eval()
    export_kwargs = dict(
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=13,
    )
    try:
        # Prefer the stable TorchScript exporter regardless of torch version.
        torch.onnx.export(model, torch.zeros(1, 1, 28, 28), out_path, dynamo=False, **export_kwargs)
    except TypeError:
        torch.onnx.export(model, torch.zeros(1, 1, 28, 28), out_path, **export_kwargs)
    print(f"exported {out_path} ({os.path.getsize(out_path) / 1024:.0f} KB), test_acc={acc:.4f}")
    assert acc > 0.97, "digit model accuracy below ship threshold"


if __name__ == "__main__":
    main()
