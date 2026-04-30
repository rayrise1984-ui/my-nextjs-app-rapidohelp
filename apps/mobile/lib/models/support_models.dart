// Marketplace models for RapidoHelp gig economy platform

class Job {
  final String id;
  final String userId;
  final String? workerId;
  final String serviceType;
  final String description;
  final double locationLat;
  final double locationLng;
  final String? locationName;
  final String status;
  final double? estimatedPrice;
  final double? finalPrice;
  final String paymentStatus;
  final String? paymentMethod;
  final String? paymentReference;
  final DateTime? paidAt;
  final double? companyFeeAmount;
  final double? workerPayoutAmount;
  final DateTime createdAt;
  final DateTime? acceptedAt;
  final DateTime? completedAt;
  final DateTime updatedAt;

  const Job({
    required this.id,
    required this.userId,
    this.workerId,
    required this.serviceType,
    required this.description,
    required this.locationLat,
    required this.locationLng,
    this.locationName,
    required this.status,
    this.estimatedPrice,
    this.finalPrice,
    required this.paymentStatus,
    this.paymentMethod,
    this.paymentReference,
    this.paidAt,
    this.companyFeeAmount,
    this.workerPayoutAmount,
    required this.createdAt,
    this.acceptedAt,
    this.completedAt,
    required this.updatedAt,
  });

  factory Job.fromJson(Map<String, dynamic> json) {
    return Job(
      id: json['id'] as String,
      userId: json['user_id'] as String,
      workerId: json['worker_id'] as String?,
      serviceType: json['service_type'] as String,
      description: json['description'] as String,
      locationLat: (json['location_lat'] as num).toDouble(),
      locationLng: (json['location_lng'] as num).toDouble(),
      locationName: json['location_name'] as String?,
      status: json['status'] as String,
      estimatedPrice: json['estimated_price'] != null ? (json['estimated_price'] as num).toDouble() : null,
      finalPrice: json['final_price'] != null ? (json['final_price'] as num).toDouble() : null,
      paymentStatus: (json['payment_status'] as String?) ?? 'unpaid',
      paymentMethod: json['payment_method'] as String?,
      paymentReference: json['payment_reference'] as String?,
      paidAt: json['paid_at'] != null ? DateTime.parse(json['paid_at'] as String) : null,
      companyFeeAmount: json['company_fee_amount'] != null ? (json['company_fee_amount'] as num).toDouble() : null,
      workerPayoutAmount: json['worker_payout_amount'] != null ? (json['worker_payout_amount'] as num).toDouble() : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      acceptedAt: json['accepted_at'] != null ? DateTime.parse(json['accepted_at'] as String) : null,
      completedAt: json['completed_at'] != null ? DateTime.parse(json['completed_at'] as String) : null,
      updatedAt: DateTime.parse(json['updated_at'] as String),
    );
  }

  Job copyWith({
    String? status,
    String? workerId,
    String? paymentStatus,
    String? paymentMethod,
    String? paymentReference,
    DateTime? paidAt,
    double? companyFeeAmount,
    double? workerPayoutAmount,
  }) {
    return Job(
      id: id,
      userId: userId,
      workerId: workerId ?? this.workerId,
      serviceType: serviceType,
      description: description,
      locationLat: locationLat,
      locationLng: locationLng,
      locationName: locationName,
      status: status ?? this.status,
      estimatedPrice: estimatedPrice,
      finalPrice: finalPrice,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      paymentReference: paymentReference ?? this.paymentReference,
      paidAt: paidAt ?? this.paidAt,
      companyFeeAmount: companyFeeAmount ?? this.companyFeeAmount,
      workerPayoutAmount: workerPayoutAmount ?? this.workerPayoutAmount,
      createdAt: createdAt,
      acceptedAt: acceptedAt,
      completedAt: completedAt,
      updatedAt: updatedAt,
    );
  }

  double? get payableAmount => finalPrice ?? estimatedPrice;

  double? get effectiveCompanyFeeAmount {
    if (companyFeeAmount != null) return companyFeeAmount;
    final amount = payableAmount;
    if (amount == null) return null;
    return _round2(amount * 0.2);
  }

  double? get effectiveWorkerPayoutAmount {
    if (workerPayoutAmount != null) return workerPayoutAmount;
    final amount = payableAmount;
    if (amount == null) return null;
    return _round2(amount - (effectiveCompanyFeeAmount ?? 0));
  }

  static double _round2(double value) => (value * 100).roundToDouble() / 100;
}

class WorkerRating {
  final String id;
  final String jobId;
  final String fromUserId;
  final String toWorkerId;
  final int rating;
  final String? comment;
  final DateTime createdAt;

  const WorkerRating({
    required this.id,
    required this.jobId,
    required this.fromUserId,
    required this.toWorkerId,
    required this.rating,
    this.comment,
    required this.createdAt,
  });

  factory WorkerRating.fromJson(Map<String, dynamic> json) {
    return WorkerRating(
      id: json['id'] as String,
      jobId: json['job_id'] as String,
      fromUserId: json['from_user_id'] as String,
      toWorkerId: json['to_worker_id'] as String,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }
}

class PayoutSplit {
  final double companyFeeAmount;
  final double workerPayoutAmount;

  const PayoutSplit({
    required this.companyFeeAmount,
    required this.workerPayoutAmount,
  });
}

PayoutSplit calculatePayoutSplit(double amount) {
  final roundedAmount = _round2(amount);
  final companyFeeAmount = _round2(roundedAmount * 0.2);
  return PayoutSplit(
    companyFeeAmount: companyFeeAmount,
    workerPayoutAmount: _round2(roundedAmount - companyFeeAmount),
  );
}

double _round2(double value) => (value * 100).roundToDouble() / 100;

Map<String, dynamic> jsonObjectFromRpc(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  if (value is List && value.isNotEmpty) {
    return jsonObjectFromRpc(value.first);
  }
  throw const FormatException('Expected RPC to return a JSON object.');
}
